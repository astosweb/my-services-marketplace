import SwiftUI

enum AppDestination: String, CaseIterable, Identifiable, Hashable {
    case explore = "Explore"
    case requests = "My Requests"
    case messages = "Messages"
    case profile = "Profile"

    var id: Self { self }

    var symbol: String {
        switch self {
        case .explore: "safari"
        case .requests: "list.bullet.clipboard"
        case .messages: "bubble.left.and.bubble.right"
        case .profile: "person.crop.circle"
        }
    }
}

struct MainShellView: View {
    @Environment(AuthSession.self) private var auth
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.scenePhase) private var scenePhase
    @State private var selection: AppDestination = .explore

    var body: some View {
        Group {
            if horizontalSizeClass == .regular {
                NavigationSplitView {
                    List {
                        ForEach(AppDestination.allCases) { destination in
                            Button {
                                selection = destination
                            } label: {
                                Label(destination.rawValue, systemImage: destination.symbol)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .badge(destination == .messages ? auth.messageUnreadCount : 0)
                            .listRowBackground(
                                selection == destination
                                    ? Color.accentColor.opacity(0.14)
                                    : Color.clear
                            )
                            .accessibilityAddTraits(selection == destination ? .isSelected : [])
                        }
                    }
                    .navigationTitle("Hero")
                } detail: {
                    NavigationStack {
                        destinationView(selection)
                    }
                }
            } else {
                TabView(selection: $selection) {
                    ForEach(AppDestination.allCases) { destination in
                        NavigationStack {
                            destinationView(destination)
                        }
                        .tabItem {
                            Label(destination.rawValue, systemImage: destination.symbol)
                        }
                        .badge(destination == .messages ? auth.messageUnreadCount : 0)
                        .tag(destination)
                    }
                }
            }
        }
        .task { await auth.refreshInboxBadges() }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await auth.refreshInboxBadges() }
        }
        .onChange(of: selection) { _, newValue in
            guard newValue != .messages else { return }
            Task { await auth.refreshInboxBadges() }
        }
    }

    @ViewBuilder
    private func destinationView(_ destination: AppDestination) -> some View {
        switch destination {
        case .explore: ExploreView()
        case .requests: MyRequestsView()
        case .messages: ConversationsView()
        case .profile: ProfileView()
        }
    }
}

private struct MyRequestsView: View {
    @Environment(AuthSession.self) private var auth
    @State private var role: RequestRole = .owner
    @State private var requests: [ServiceRequest] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var isNewRequestPresented = false

    private enum RequestRole: String, CaseIterable, Identifiable {
        case owner
        case provider

        var id: Self { self }

        var label: String {
            switch self {
            case .owner: "Posted"
            case .provider: "Working"
            }
        }
    }

    private var columns: [GridItem] {
        [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("Role", selection: $role) {
                ForEach(RequestRole.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.bar)

            Divider()
                .opacity(0.4)

            ScrollView {
                if isLoading && requests.isEmpty {
                    ProgressView("Loading requests")
                        .frame(maxWidth: .infinity)
                        .padding(.top, 80)
                } else if let errorMessage, requests.isEmpty {
                    ContentUnavailableView {
                        Label("Couldn’t Load Requests", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(errorMessage)
                    } actions: {
                        Button("Retry") { Task { await load() } }
                            .buttonStyle(.borderedProminent)
                    }
                } else if requests.isEmpty {
                    ContentUnavailableView {
                        Label(
                            role == .owner ? "No Requests Yet" : "No Jobs Yet",
                            systemImage: "tray"
                        )
                    } description: {
                        Text(
                            role == .owner
                                ? "Your posted requests will appear here."
                                : "Requests you’ve offered on will appear here."
                        )
                    } actions: {
                        if role == .owner {
                            Button("New Request") {
                                isNewRequestPresented = true
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }
                } else {
                    LazyVGrid(columns: columns, spacing: 10) {
                        ForEach(requests) { request in
                            NavigationLink(value: request) {
                                RequestCard(request: request)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                }
            }
            .refreshable {
                await load()
                await auth.refreshInboxBadges()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("My Requests")
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: ServiceRequest.self) { request in
            RequestDetailView(request: request)
        }
        .notificationsToolbar()
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    isNewRequestPresented = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("New request")
            }
        }
        .sheet(isPresented: $isNewRequestPresented) {
            NavigationStack {
                NewRequestView(onCreated: { created in
                    role = .owner
                    requests.insert(created, at: 0)
                })
            }
        }
        .onChange(of: role) {
            requests = []
            errorMessage = nil
        }
        .task(id: role) { await load() }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            let response: PaginatedEnvelope<[ServiceRequest], PageMeta> = try await auth.api.send(
                path: "requests/mine",
                query: [URLQueryItem(name: "role", value: role.rawValue)]
            )
            requests = response.data
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

private struct NotificationsToolbarModifier: ViewModifier {
    @Environment(AuthSession.self) private var auth
    @State private var isNotificationsPresented = false

    func body(content: Content) -> some View {
        content
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isNotificationsPresented = true
                    } label: {
                        Image(systemName: auth.notificationUnreadCount > 0 ? "bell.badge.fill" : "bell")
                    }
                    .badge(auth.notificationUnreadCount)
                    .accessibilityLabel(
                        auth.notificationUnreadCount > 0
                            ? "Notifications, \(auth.notificationUnreadCount) unread"
                            : "Notifications"
                    )
                }
            }
            .sheet(isPresented: $isNotificationsPresented, onDismiss: {
                Task { await auth.refreshInboxBadges() }
            }) {
                NavigationStack {
                    NotificationsView()
                }
            }
            .task { await auth.refreshInboxBadges() }
    }
}

extension View {
    func notificationsToolbar() -> some View {
        modifier(NotificationsToolbarModifier())
    }
}

private struct NotificationsView: View {
    @Environment(AuthSession.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @State private var notifications: [AppNotification] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var openedRequest: ServiceRequest?

    var body: some View {
        ZStack {
            if isLoading && notifications.isEmpty {
                List { }
                    .overlay { ProgressView("Loading notifications") }
                    .refreshable { await load() }
            } else if let errorMessage, notifications.isEmpty {
                List { }
                    .overlay {
                        ContentUnavailableView(
                            "Couldn’t Load Notifications",
                            systemImage: "wifi.exclamationmark",
                            description: Text(errorMessage)
                        )
                    }
                    .refreshable { await load() }
            } else if notifications.isEmpty {
                List { }
                    .overlay { ContentUnavailableView("No Notifications", systemImage: "bell.slash") }
                    .refreshable { await load() }
            } else {
                List(notifications) { notification in
                    Button {
                        Task { await handleTap(notification) }
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: symbol(for: notification.kind))
                                .foregroundStyle(notification.isRead ? Color.secondary : Color.accentColor)
                                .frame(width: 28)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(notification.title)
                                    .fontWeight(notification.isRead ? .regular : .semibold)
                                Text(notification.body)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                if let tag = notification.contextTag, !tag.isEmpty {
                                    Text(tag)
                                        .font(.caption)
                                        .foregroundStyle(.tertiary)
                                }
                                Text(notification.createdAt, style: .relative)
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
                .refreshable { await load() }
            }
        }
        .navigationTitle("Notifications")
        .navigationDestination(item: $openedRequest) { request in
            RequestDetailView(request: request)
        }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Done") { dismiss() }
            }
            ToolbarItem(placement: .primaryAction) {
                Button("Read All") {
                    Task { await markAllRead() }
                }
                .disabled(!notifications.contains { !$0.isRead })
            }
        }
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        do {
            let response: PaginatedEnvelope<[AppNotification], NotificationMeta> = try await auth.api.send(
                path: "notifications"
            )
            notifications = response.data
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func handleTap(_ notification: AppNotification) async {
        await markRead(notification)
        guard let requestId = notification.payload?.stringValue(for: "requestId") else { return }
        do {
            let response: APIEnvelope<ServiceRequest> = try await auth.api.send(
                path: "requests/\(requestId)"
            )
            openedRequest = response.data
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func markRead(_ notification: AppNotification) async {
        guard !notification.isRead else { return }
        struct ReadBody: Encodable { let isRead = true }
        let _: APIEnvelope<AppNotification>? = try? await auth.api.send(
            "PATCH",
            path: "notifications/\(notification.id)",
            body: ReadBody()
        )
        await load()
    }

    private func markAllRead() async {
        let _: APIEnvelope<OKResponse>? = try? await auth.api.send(
            "POST",
            path: "notifications/read-all"
        )
        await load()
    }

    private func symbol(for kind: NotificationKind) -> String {
        switch kind {
        case .newMessage: "message.fill"
        case .newOffer, .offerAccepted, .offerDeclined: "eurosign.circle.fill"
        case .jobCompleted: "checkmark.circle.fill"
        case .review: "star.fill"
        case .premiumBoost: "sparkles"
        case .paymentReceived: "creditcard.fill"
        case .reminder: "clock.fill"
        case .system: "info.circle.fill"
        }
    }
}

#Preview("Main Shell") {
    MainShellView()
        .environment(AuthSession())
}
