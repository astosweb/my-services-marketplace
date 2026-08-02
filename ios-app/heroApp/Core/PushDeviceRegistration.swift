import Foundation
import UIKit
import UserNotifications

/// Requests notification permission, registers for remote notifications, and
/// upserts the installation via `POST /devices`. Prefers the real APNs token;
/// falls back to `identifierForVendor` so the device still appears in admin
/// without Push capability (fallback tokens are not used for APNs delivery).
@MainActor
final class PushDeviceRegistration: NSObject {
    static let shared = PushDeviceRegistration()

    private weak var auth: AuthSession?
    private var registeredToken: String?
    private var apnsToken: String?

    private override init() {
        super.init()
    }

    func configure(auth: AuthSession) {
        self.auth = auth
        UNUserNotificationCenter.current().delegate = self
    }

    func startIfSignedIn() {
        guard auth?.state == .signedIn else { return }
        Task { await registerInstallation() }
        Task { await requestAuthorizationAndRegister() }
    }

    func handleDidRegisterForRemoteNotifications(deviceToken data: Data) {
        let token = data.map { String(format: "%02.2hhx", $0) }.joined()
        apnsToken = token
        guard auth?.state == .signedIn else { return }
        Task { await register(token: token) }
    }

    func handleDidFailToRegisterForRemoteNotifications(error: Error) {
        #if DEBUG
        print("APNs registration failed: \(error.localizedDescription)")
        #endif
    }

    func authorizationStatus() async -> UNAuthorizationStatus {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    @discardableResult
    func requestAuthorizationAndRegister() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        let granted: Bool
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            granted = true
        case .denied:
            granted = false
        case .notDetermined:
            granted = (try? await center.requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        @unknown default:
            granted = false
        }
        if granted {
            await MainActor.run {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
        return granted
    }

    func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    func unregisterCurrent() async {
        guard let token = registeredToken, let auth else { return }
        let encoded = token.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? token
        let _: APIEnvelope<OKResponse>? = try? await auth.api.send(
            "DELETE",
            path: "devices/\(encoded)",
            authenticated: true
        )
        registeredToken = nil
    }

    private func registerInstallation() async {
        if let apnsToken {
            await register(token: apnsToken)
            return
        }
        let vendorId = UIDevice.current.identifierForVendor?.uuidString
            ?? UserDefaults.standard.string(forKey: "hero.installationId")
            ?? {
                let id = UUID().uuidString
                UserDefaults.standard.set(id, forKey: "hero.installationId")
                return id
            }()
        await register(token: "idfv-\(vendorId)")
    }

    private func register(token: String) async {
        guard let auth, auth.state == .signedIn else { return }
        let previous = registeredToken
        let info = Bundle.main.infoDictionary
        let appVersion = info?["CFBundleShortVersionString"] as? String
        let body = RegisterDeviceRequest(
            token: token,
            platform: "ios",
            name: UIDevice.current.name,
            systemVersion: UIDevice.current.systemVersion,
            appVersion: appVersion
        )
        do {
            let _: APIEnvelope<RegisteredDevice> = try await auth.api.send(
                "POST",
                path: "devices",
                body: body
            )
            registeredToken = token
            // Prefer APNs over the IDFV fallback — drop the temporary row.
            if let previous,
               previous != token,
               previous.hasPrefix("idfv-") {
                let encoded = previous.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? previous
                let _: APIEnvelope<OKResponse>? = try? await auth.api.send(
                    "DELETE",
                    path: "devices/\(encoded)",
                    authenticated: true
                )
            }
        } catch {
            #if DEBUG
            print("Device registration failed: \(error.localizedDescription)")
            #endif
        }
    }
}

extension PushDeviceRegistration: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            PushDeviceRegistration.shared.handleDidRegisterForRemoteNotifications(deviceToken: deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            PushDeviceRegistration.shared.handleDidFailToRegisterForRemoteNotifications(error: error)
        }
    }
}
