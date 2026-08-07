import Foundation

/// Socket.IO v4 client over Engine.IO websocket transport (no third-party deps).
/// Speaks the Gobid `/realtime` namespace using JWT auth in the handshake auth payload.
@MainActor
final class RealtimeSocketClient: NSObject {
    enum ConnectionState: Equatable {
        case disconnected
        case connecting
        case connected
    }

    private let baseURL: URL
    private var accessTokenProvider: () async -> String?
    private var webSocket: URLSessionWebSocketTask?
    private var session: URLSession!
    private var pingTask: Task<Void, Never>?
    private var reconnectTask: Task<Void, Never>?
    private var intentionalClose = false
    private(set) var state: ConnectionState = .disconnected
    private var sid: String?
    private var handlers: [String: [(Data) -> Void]] = [:]
    private var joinedRooms = Set<String>()

    var onStateChange: ((ConnectionState) -> Void)?
    var onEvent: ((String, [String: Any]) -> Void)?

    init(baseURL: URL = APIConfiguration.baseURL, accessTokenProvider: @escaping () async -> String?) {
        self.baseURL = baseURL
        self.accessTokenProvider = accessTokenProvider
        super.init()
        self.session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
    }

    func connect() {
        intentionalClose = false
        guard state != .connecting, state != .connected else { return }
        state = .connecting
        onStateChange?(.connecting)

        Task { [weak self] in
            guard let self else { return }
            guard let token = await self.accessTokenProvider(), !token.isEmpty else {
                await MainActor.run {
                    self.state = .disconnected
                    self.onStateChange?(.disconnected)
                }
                return
            }
            await self.openSocket(token: token)
        }
    }

    func disconnect() {
        intentionalClose = true
        pingTask?.cancel()
        reconnectTask?.cancel()
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        state = .disconnected
        onStateChange?(.disconnected)
    }

    func join(room: String) {
        joinedRooms.insert(room)
        emit("room.join", ["room": room])
    }

    func leave(room: String) {
        joinedRooms.remove(room)
        emit("room.leave", ["room": room])
    }

    func setTyping(room: String, isTyping: Bool) {
        emit("typing.update", ["room": room, "isTyping": isTyping])
    }

    func pingPresence() {
        emit("presence.ping", [:])
    }

    func markRead(conversationId: String) {
        emit("message.read", ["conversationId": conversationId])
    }

    func markDelivered(conversationId: String, messageId: String) {
        emit("message.delivered", [
            "conversationId": conversationId,
            "messageId": messageId,
        ])
    }

    func on(_ event: String, handler: @escaping (Data) -> Void) {
        handlers[event, default: []].append(handler)
    }

    private var pendingAuthToken: String?

    private func openSocket(token: String) async {
        pendingAuthToken = token
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        let isTLS = (components.scheme ?? "http").hasPrefix("https")
        components.scheme = isTLS ? "wss" : "ws"
        components.path = "/socket.io/"
        components.queryItems = [
            URLQueryItem(name: "EIO", value: "4"),
            URLQueryItem(name: "transport", value: "websocket"),
        ]

        guard let url = components.url else { return }
        let request = URLRequest(url: url)
        let task = session.webSocketTask(with: request)
        webSocket = task
        task.resume()
        listen()
    }

    private func sendNamespaceConnect() {
        guard let token = pendingAuthToken else { return }
        let authJSON = #"{"token":"\#(token.replacingOccurrences(of: "\"", with: "\\\""))"}"#
        sendRaw("40/realtime,\(authJSON)")
    }

    private func listen() {
        webSocket?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure:
                Task { @MainActor in
                    self.handleDisconnect()
                }
            case .success(let message):
                Task { @MainActor in
                    self.handle(message: message)
                    self.listen()
                }
            }
        }
    }

    private func handle(message: URLSessionWebSocketTask.Message) {
        let text: String
        switch message {
        case .string(let value): text = value
        case .data(let data): text = String(data: data, encoding: .utf8) ?? ""
        @unknown default: return
        }
        guard !text.isEmpty else { return }

        // Engine.IO packet types: 0 open, 2 ping, 3 pong, 4 message
        let type = text.prefix(1)
        let body = String(text.dropFirst())
        switch type {
        case "0":
            // open — connect namespace with JWT, then start ping loop
            sendNamespaceConnect()
            startPing()
        case "2":
            sendRaw("3")
        case "4":
            handleSocketIO(body)
        default:
            break
        }
    }

    private func handleSocketIO(_ packet: String) {
        // Socket.IO: 0 connect, 2 event, 40 namespace connect ack, 42 event
        if packet.hasPrefix("0/realtime") || packet.hasPrefix("40") {
            state = .connected
            onStateChange?(.connected)
            // Rejoin rooms after reconnect.
            for room in joinedRooms {
                emit("room.join", ["room": room])
            }
            pingPresence()
            return
        }

        guard packet.hasPrefix("2") || packet.hasPrefix("42") else { return }
        let payload = packet.hasPrefix("42") ? String(packet.dropFirst(2)) : String(packet.dropFirst())
        // May be namespaced: /realtime,["event",{...}]
        let jsonPart: String
        if let comma = payload.firstIndex(of: ","), payload.hasPrefix("/") {
            jsonPart = String(payload[payload.index(after: comma)...])
        } else {
            jsonPart = payload
        }
        guard let data = jsonPart.data(using: .utf8),
              let array = try? JSONSerialization.jsonObject(with: data) as? [Any],
              let event = array.first as? String
        else { return }

        let eventData = array.count > 1 ? array[1] : [:]
        if let dict = eventData as? [String: Any] {
            onEvent?(event, dict)
            if let encoded = try? JSONSerialization.data(withJSONObject: dict) {
                for handler in handlers[event] ?? [] {
                    handler(encoded)
                }
            }
            // Also forward envelope.event when present for typed listeners.
            if let nestedEvent = dict["event"] as? String,
               let nestedData = try? JSONSerialization.data(withJSONObject: dict)
            {
                for handler in handlers[nestedEvent] ?? [] {
                    handler(nestedData)
                }
            }
        }
    }

    private func emit(_ event: String, _ data: [String: Any]) {
        guard state == .connected else { return }
        guard let payload = try? JSONSerialization.data(withJSONObject: [event, data]),
              let json = String(data: payload, encoding: .utf8)
        else { return }
        // 42 = event packet; namespace /realtime
        sendRaw("42/realtime,\(json)")
    }

    private func sendRaw(_ text: String) {
        webSocket?.send(.string(text)) { _ in }
    }

    private func startPing() {
        pingTask?.cancel()
        pingTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 20_000_000_000)
                await MainActor.run {
                    self?.sendRaw("2")
                    self?.pingPresence()
                }
            }
        }
    }

    private func handleDisconnect() {
        state = .disconnected
        onStateChange?(.disconnected)
        pingTask?.cancel()
        webSocket = nil
        guard !intentionalClose else { return }
        reconnectTask?.cancel()
        reconnectTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            await MainActor.run { self?.connect() }
        }
    }
}

extension RealtimeSocketClient: URLSessionWebSocketDelegate {
    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        Task { @MainActor in
            self.handleDisconnect()
        }
    }
}
