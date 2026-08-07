import Foundation
import Security

nonisolated enum APIConfiguration {
    static let baseURL: URL = {
        let configured = (Bundle.main.object(forInfoDictionaryKey: "GOBID_API_BASE_URL") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let candidate = (configured?.isEmpty == false ? configured : nil) ?? "http://127.0.0.1:3000"
        return URL(string: candidate)!
    }()

    /// Rewrite Spaces/CDN or localhost media links to `GOBID_API_BASE_URL/uploads/…`
    /// so AsyncImage hits the API proxy (works when Spaces ACLs are disabled).
    static func resolveMediaURL(_ url: URL) -> URL {
        let path = url.path
        let uploadPath: String
        if path.hasPrefix("/uploads/") {
            uploadPath = path
        } else if path.hasPrefix("/requests/")
            || path.hasPrefix("/avatars/")
            || path.hasPrefix("/messages/")
        {
            uploadPath = "/uploads" + path
        } else {
            return url
        }

        guard var comps = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            return url
        }
        let basePath = comps.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let suffix = uploadPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        comps.path = "/" + [basePath, suffix].filter { !$0.isEmpty }.joined(separator: "/")
        comps.query = url.query
        return comps.url ?? url
    }
}

enum APIError: LocalizedError {
    case invalidResponse
    case server(status: Int, code: String?, message: String)
    case transport(String)
    case decoding
    case signedOut

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "The server returned an invalid response."
        case .server(_, _, let message): message
        case .transport(let message): message
        case .decoding: "The server response could not be read."
        case .signedOut: "Your session expired. Please sign in again."
        }
    }
}

nonisolated struct KeychainTokenStore: Sendable {
    private let service = Bundle.main.bundleIdentifier ?? "ee.gobid.app"
    private let account = "refresh-token"

    func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func save(_ token: String) throws {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        let result: OSStatus
        if status == errSecSuccess {
            result = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        } else {
            var insert = query
            insert[kSecValueData as String] = data
            insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            result = SecItemAdd(insert as CFDictionary, nil)
        }
        guard result == errSecSuccess else {
            throw APIError.transport("Secure token storage is unavailable.")
        }
    }

    func delete() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}

@MainActor
final class APIClient {
    private let session: URLSession
    private let uploadSession: URLSession
    private let tokenStore: KeychainTokenStore
    private var accessToken: String?
    private var refreshToken: String?
    private var persistsRefreshToken = false
    private var isRefreshing = false
    private var refreshWaiters: [CheckedContinuation<AuthPayload, Error>] = []
    var onSessionExpired: (() -> Void)?

    init(session: URLSession? = nil, tokenStore: KeychainTokenStore = KeychainTokenStore()) {
        if let session {
            self.session = session
            self.uploadSession = session
        } else {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.timeoutIntervalForRequest = 15
            configuration.timeoutIntervalForResource = 20
            configuration.waitsForConnectivity = false
            self.session = URLSession(configuration: configuration)

            let uploadConfiguration = URLSessionConfiguration.ephemeral
            uploadConfiguration.timeoutIntervalForRequest = 120
            uploadConfiguration.timeoutIntervalForResource = 300
            uploadConfiguration.waitsForConnectivity = true
            self.uploadSession = URLSession(configuration: uploadConfiguration)
        }
        self.tokenStore = tokenStore
    }

    var currentRefreshToken: String? { refreshToken }
    var currentAccessToken: String? { accessToken }

    func restorePersistedRefreshToken() -> String? {
        let token = tokenStore.read()
        refreshToken = token
        persistsRefreshToken = token != nil
        return token
    }

    func setCredentials(_ payload: AuthPayload, rememberMe: Bool) throws {
        accessToken = payload.accessToken
        refreshToken = payload.refreshToken
        persistsRefreshToken = rememberMe
        if rememberMe {
            try tokenStore.save(payload.refreshToken)
        } else {
            tokenStore.delete()
        }
    }

    func clearCredentials() {
        accessToken = nil
        refreshToken = nil
        persistsRefreshToken = false
        tokenStore.delete()
    }

    func send<Response: Decodable>(
        _ method: String = "GET",
        path: String,
        query: [URLQueryItem] = [],
        authenticated: Bool = true
    ) async throws -> Response {
        try await send(method, path: path, query: query, body: Optional<EmptyBody>.none, authenticated: authenticated)
    }

    func send<Body: Encodable, Response: Decodable>(
        _ method: String,
        path: String,
        query: [URLQueryItem] = [],
        body: Body?,
        authenticated: Bool = true
    ) async throws -> Response {
        let request = try makeRequest(method, path: path, query: query, body: body, token: authenticated ? accessToken : nil)
        do {
            return try await perform(request)
        } catch APIError.server(let status, _, _) where status == 401 && authenticated {
            let payload = try await synchronizedRefresh()
            let retry = try makeRequest(method, path: path, query: query, body: body, token: payload.accessToken)
            return try await perform(retry)
        }
    }

    /// Sends a request that expects an empty success body (e.g. HTTP 204).
    func sendNoContent<Body: Encodable>(
        _ method: String,
        path: String,
        query: [URLQueryItem] = [],
        body: Body?,
        authenticated: Bool = true
    ) async throws {
        let request = try makeRequest(method, path: path, query: query, body: body, token: authenticated ? accessToken : nil)
        do {
            try await performNoContent(request)
        } catch APIError.server(let status, _, _) where status == 401 && authenticated {
            let payload = try await synchronizedRefresh()
            let retry = try makeRequest(method, path: path, query: query, body: body, token: payload.accessToken)
            try await performNoContent(retry)
        }
    }

    func uploadMultipart<Response: Decodable>(
        path: String,
        fieldName: String,
        filename: String,
        mimeType: String,
        fileData: Data,
        authenticated: Bool = true,
        onProgress: (@Sendable (Double) -> Void)? = nil
    ) async throws -> Response {
        try await uploadMultipart(
            path: path,
            parts: [
                MultipartFilePart(
                    fieldName: fieldName,
                    filename: filename,
                    mimeType: mimeType,
                    data: fileData
                )
            ],
            authenticated: authenticated,
            onProgress: onProgress
        )
    }

    func uploadMultipart<Response: Decodable>(
        path: String,
        parts: [MultipartFilePart],
        authenticated: Bool = true,
        onProgress: (@Sendable (Double) -> Void)? = nil
    ) async throws -> Response {
        let request = try makeMultipartRequest(
            path: path,
            parts: parts,
            token: authenticated ? accessToken : nil
        )
        do {
            return try await performUpload(request, onProgress: onProgress)
        } catch APIError.server(let status, _, _) where status == 401 && authenticated {
            let payload = try await synchronizedRefresh()
            let retry = try makeMultipartRequest(path: path, parts: parts, token: payload.accessToken)
            return try await performUpload(retry, onProgress: onProgress)
        }
    }

    func refreshSession() async throws -> AuthPayload {
        try await synchronizedRefresh()
    }

    private func synchronizedRefresh() async throws -> AuthPayload {
        if isRefreshing {
            return try await withCheckedThrowingContinuation { continuation in
                refreshWaiters.append(continuation)
            }
        }

        guard let refreshToken else {
            onSessionExpired?()
            throw APIError.signedOut
        }

        isRefreshing = true
        let shouldPersist = persistsRefreshToken
        do {
            let response: APIEnvelope<AuthPayload> = try await send(
                "POST",
                path: "auth/refresh",
                body: RefreshRequest(refreshToken: refreshToken),
                authenticated: false
            )
            let payload = response.data
            try setCredentials(payload, rememberMe: shouldPersist)
            finishRefresh(returning: payload)
            return payload
        } catch {
            clearCredentials()
            onSessionExpired?()
            finishRefresh(throwing: APIError.signedOut)
            throw APIError.signedOut
        }
    }

    private func finishRefresh(returning payload: AuthPayload) {
        isRefreshing = false
        let waiters = refreshWaiters
        refreshWaiters = []
        for waiter in waiters {
            waiter.resume(returning: payload)
        }
    }

    private func finishRefresh(throwing error: Error) {
        isRefreshing = false
        let waiters = refreshWaiters
        refreshWaiters = []
        for waiter in waiters {
            waiter.resume(throwing: error)
        }
    }

    private func makeRequest<Body: Encodable>(
        _ method: String,
        path: String,
        query: [URLQueryItem],
        body: Body?,
        token: String?
    ) throws -> URLRequest {
        var url = APIConfiguration.baseURL.appending(path: path)
        if !query.isEmpty {
            url.append(queryItems: query)
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try Self.encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return request
    }

    private func makeMultipartRequest(
        path: String,
        parts: [MultipartFilePart],
        token: String?
    ) throws -> (request: URLRequest, body: Data) {
        guard !parts.isEmpty else {
            throw APIError.transport("No files to upload.")
        }
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: APIConfiguration.baseURL.appending(path: path))
        request.httpMethod = "POST"
        request.timeoutInterval = 120
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body = Data()
        for part in parts {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append(
                "Content-Disposition: form-data; name=\"\(part.fieldName)\"; filename=\"\(part.filename)\"\r\n"
                    .data(using: .utf8)!
            )
            body.append("Content-Type: \(part.mimeType)\r\n\r\n".data(using: .utf8)!)
            body.append(part.data)
            body.append("\r\n".data(using: .utf8)!)
        }
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        return (request, body)
    }

    private func performUpload<Response: Decodable>(
        _ prepared: (request: URLRequest, body: Data),
        onProgress: (@Sendable (Double) -> Void)?
    ) async throws -> Response {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await upload(prepared.request, from: prepared.body, onProgress: onProgress)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
        return try decodeSuccess(data: data, response: response)
    }

    private func upload(
        _ request: URLRequest,
        from body: Data,
        onProgress: (@Sendable (Double) -> Void)?
    ) async throws -> (Data, URLResponse) {
        try await withCheckedThrowingContinuation { continuation in
            let box = UploadProgressObservation()

            let task = uploadSession.uploadTask(with: request, from: body) { data, response, error in
                box.observation?.invalidate()
                box.observation = nil
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let data, let response else {
                    continuation.resume(throwing: APIError.invalidResponse)
                    return
                }
                continuation.resume(returning: (data, response))
            }

            if let onProgress {
                box.observation = task.progress.observe(\.fractionCompleted, options: [.initial, .new]) { progress, _ in
                    onProgress(progress.fractionCompleted)
                }
            }
            task.resume()
        }
    }

    private func perform<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
        return try decodeSuccess(data: data, response: response)
    }

    private func decodeSuccess<Response: Decodable>(data: Data, response: URLResponse) throws -> Response {
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard 200..<300 ~= http.statusCode else {
            let body = try? Self.decoder.decode(APIErrorEnvelope.self, from: data)
            throw APIError.server(
                status: http.statusCode,
                code: body?.error.code,
                message: body?.error.message ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
            )
        }
        do {
            return try Self.decoder.decode(Response.self, from: data)
        } catch {
            throw APIError.decoding
        }
    }

    private func performNoContent(_ request: URLRequest) async throws {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard 200..<300 ~= http.statusCode else {
            let body = try? Self.decoder.decode(APIErrorEnvelope.self, from: data)
            throw APIError.server(
                status: http.statusCode,
                code: body?.error.code,
                message: body?.error.message ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
            )
        }
    }

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            if let date = ISO8601DateFormatter.fractional.date(from: value)
                ?? ISO8601DateFormatter.standard.date(from: value) {
                return date
            }
            throw DecodingError.dataCorruptedError(
                in: try decoder.singleValueContainer(),
                debugDescription: "Invalid ISO 8601 date"
            )
        }
        return decoder
    }()
}

private struct EmptyBody: Encodable {}

private final class UploadProgressObservation: @unchecked Sendable {
    var observation: NSKeyValueObservation?
}

struct MultipartFilePart: Sendable {
    let fieldName: String
    let filename: String
    let mimeType: String
    let data: Data
}

private extension ISO8601DateFormatter {
    static let fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let standard = ISO8601DateFormatter()
}
