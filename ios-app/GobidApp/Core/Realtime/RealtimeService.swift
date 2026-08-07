import Foundation

/// App-level realtime coordinator: connects after auth, refreshes badges on events,
/// and exposes room join helpers for chat / support / request screens.
@MainActor
@Observable
final class RealtimeService {
    static let shared = RealtimeService()

    private(set) var connected = false
    private var client: RealtimeSocketClient?
    private weak var auth: AuthSession?
    private var queuedJoins = Set<String>()

    private init() {}

    func configure(auth: AuthSession) {
        self.auth = auth
    }

    func startIfSignedIn() {
        guard auth?.state == .signedIn else { return }
        if client == nil {
            let api = auth!.api
            client = RealtimeSocketClient { [weak api] in
                api?.currentAccessToken
            }
            client?.onStateChange = { [weak self] state in
                self?.connected = state == .connected
                if state == .connected {
                    for room in self?.queuedJoins ?? [] {
                        self?.client?.join(room: room)
                    }
                }
            }
            client?.onEvent = { [weak self] event, _ in
                self?.handle(event: event)
            }
        }
        client?.connect()
    }

    func stop() {
        client?.disconnect()
        client = nil
        connected = false
        queuedJoins.removeAll()
    }

    func joinConversation(_ id: String) {
        join(room: "conversation:\(id)")
    }

    func leaveConversation(_ id: String) {
        leave(room: "conversation:\(id)")
    }

    func joinRequest(_ id: String) {
        join(room: "request:\(id)")
    }

    func leaveRequest(_ id: String) {
        leave(room: "request:\(id)")
    }

    func joinSupport(_ id: String) {
        join(room: "support:\(id)")
    }

    func leaveSupport(_ id: String) {
        leave(room: "support:\(id)")
    }

    func setTyping(room: String, isTyping: Bool) {
        client?.setTyping(room: room, isTyping: isTyping)
    }

    func markRead(conversationId: String) {
        client?.markRead(conversationId: conversationId)
    }

    private func join(room: String) {
        queuedJoins.insert(room)
        client?.join(room: room)
    }

    private func leave(room: String) {
        queuedJoins.remove(room)
        client?.leave(room: room)
    }

    private func handle(event: String) {
        switch event {
        case "message.created", "message.read", "conversation.updated", "unread.updated",
             "notification.created", "notification.updated",
             "support.message.created", "support.ticket.updated":
            Task { await auth?.refreshInboxBadges() }
        case "realtime.ready":
            connected = true
        default:
            break
        }
        NotificationCenter.default.post(
            name: .gobidRealtimeEvent,
            object: nil,
            userInfo: ["event": event]
        )
    }
}

extension Notification.Name {
    static let gobidRealtimeEvent = Notification.Name("gobid.realtime.event")
}
