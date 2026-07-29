import Foundation
import Observation

@MainActor
@Observable
final class AuthSession {
    enum State: Equatable {
        case restoring
        case signedOut
        case signedIn
    }

    private(set) var state: State = .restoring
    private(set) var user: User?
    private(set) var isWorking = false
    var errorMessage: String?
    var rememberMe = true
    var developmentResetToken: String?
    var messageUnreadCount = 0
    var notificationUnreadCount = 0

    let api: APIClient

    init(api: APIClient? = nil) {
        let client = api ?? APIClient()
        self.api = client
        client.onSessionExpired = { [weak self] in
            self?.isWorking = false
            self?.user = nil
            self?.messageUnreadCount = 0
            self?.notificationUnreadCount = 0
            self?.state = .signedOut
        }
    }

    func restore() async {
        guard api.restorePersistedRefreshToken() != nil else {
            state = .signedOut
            return
        }
        do {
            let payload = try await api.refreshSession()
            user = payload.user
            state = .signedIn
            await refreshInboxBadges()
        } catch {
            user = nil
            state = .signedOut
        }
    }

    func login(email: String, password: String) async -> Bool {
        await authenticate {
            let response: APIEnvelope<AuthPayload> = try await api.send(
                "POST",
                path: "auth/login",
                body: AuthRequest(
                    email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                    password: password
                ),
                authenticated: false
            )
            return response.data
        }
    }

    func register(displayName: String, email: String, password: String) async -> Bool {
        await authenticate {
            let response: APIEnvelope<AuthPayload> = try await api.send(
                "POST",
                path: "auth/register",
                body: RegisterRequest(
                    email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                    password: password,
                    displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines)
                ),
                authenticated: false
            )
            return response.data
        }
    }

    func requestPasswordReset(email: String) async -> String? {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            let response: APIEnvelope<ForgotPasswordResponse> = try await api.send(
                "POST",
                path: "auth/forgot-password",
                body: ForgotPasswordRequest(
                    email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                ),
                authenticated: false
            )
            developmentResetToken = response.data.token
            return response.data.message
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func resetPassword(token: String, password: String) async -> Bool {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            let _: APIEnvelope<OKResponse> = try await api.send(
                "POST",
                path: "auth/reset-password",
                body: ResetPasswordRequest(
                    token: token.trimmingCharacters(in: .whitespacesAndNewlines),
                    password: password
                ),
                authenticated: false
            )
            developmentResetToken = nil
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func updateUser(_ updated: User) {
        user = updated
    }

    func refreshInboxBadges() async {
        guard state == .signedIn else { return }

        async let notificationCount = fetchNotificationUnreadCount()
        async let messageCount = fetchMessageUnreadCount()
        notificationUnreadCount = await notificationCount
        messageUnreadCount = await messageCount
    }

    private func fetchNotificationUnreadCount() async -> Int {
        do {
            let response: PaginatedEnvelope<[AppNotification], NotificationMeta> = try await api.send(
                path: "notifications",
                query: [URLQueryItem(name: "limit", value: "1")]
            )
            return response.meta.unreadCount
        } catch {
            return 0
        }
    }

    private func fetchMessageUnreadCount() async -> Int {
        do {
            let response: PaginatedEnvelope<[Conversation], ConversationMeta> = try await api.send(
                path: "conversations"
            )
            return response.meta.unreadCount
        } catch {
            return 0
        }
    }

    func logout() async {
        guard state == .signedIn else { return }
        isWorking = true
        defer { isWorking = false }
        if let refreshToken = api.currentRefreshToken {
            let _: APIEnvelope<OKResponse>? = try? await api.send(
                "POST",
                path: "auth/logout",
                body: RefreshRequest(refreshToken: refreshToken),
                authenticated: false
            )
        }
        api.clearCredentials()
        user = nil
        messageUnreadCount = 0
        notificationUnreadCount = 0
        state = .signedOut
    }

    func deleteAccount(password: String) async -> Bool {
        guard state == .signedIn else { return false }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            try await api.sendNoContent(
                "DELETE",
                path: "auth/me",
                body: DeleteAccountRequest(password: password)
            )
            api.clearCredentials()
            user = nil
            messageUnreadCount = 0
            notificationUnreadCount = 0
            state = .signedOut
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func authenticate(_ operation: () async throws -> AuthPayload) async -> Bool {
        guard !isWorking else { return false }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            let payload = try await operation()
            try api.setCredentials(payload, rememberMe: rememberMe)
            user = payload.user
            state = .signedIn
            await refreshInboxBadges()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}
