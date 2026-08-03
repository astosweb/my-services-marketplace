import SwiftUI
import UserNotifications

struct NotificationPreferencesView: View {
    @Environment(AuthSession.self) private var auth

    @State private var categories: [Category] = []
    @State private var selectedIds: Set<String> = []
    @State private var maxSelections = 3
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var feedbackTrigger = 0

    var body: some View {
        Form {
            Section {
                Text("Choose up to \(maxSelections) categories. You’ll get a push when an admin publishes a new request in those categories.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Section("Push Permission") {
                LabeledContent("Status", value: permissionLabel)
                if authorizationStatus == .notDetermined {
                    Button("Allow Notifications") {
                        Task { await requestPermission() }
                    }
                } else if authorizationStatus == .denied {
                    Button("Open Settings") {
                        PushDeviceRegistration.shared.openSystemSettings()
                    }
                } else {
                    Button("Refresh Device Registration") {
                        PushDeviceRegistration.shared.startIfSignedIn()
                    }
                }
            }

            Section {
                if isLoading {
                    ProgressView("Loading categories")
                        .frame(maxWidth: .infinity)
                } else {
                    ForEach(categories) { category in
                        let isSelected = selectedIds.contains(category.id)
                        let atLimit = selectedIds.count >= maxSelections && !isSelected
                        Button {
                            toggle(category.id)
                        } label: {
                            HStack {
                                Label(category.name, systemImage: category.symbol)
                                    .foregroundStyle(atLimit ? .secondary : .primary)
                                Spacer()
                                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(isSelected ? Color.accentColor : .secondary)
                            }
                        }
                        .disabled(atLimit)
                        .accessibilityAddTraits(isSelected ? .isSelected : [])
                    }
                }
            } header: {
                Text("Categories")
            } footer: {
                Text("\(selectedIds.count) of \(maxSelections) selected")
            }

            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.circle.fill")
                        .foregroundStyle(.red)
                }
            }
            if let successMessage {
                Section {
                    Label(successMessage, systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                }
            }

            Section {
                Button {
                    Task { await save() }
                } label: {
                    if isSaving { ProgressView() } else { Text("Save Preferences") }
                }
                .disabled(isLoading || isSaving)
            }
        }
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await refreshPermissionStatus()
            await load()
            if authorizationStatus == .notDetermined {
                await requestPermission()
            } else if authorizationStatus == .authorized || authorizationStatus == .provisional {
                PushDeviceRegistration.shared.startIfSignedIn()
            }
        }
        .sensoryFeedback(.success, trigger: feedbackTrigger)
    }

    private var permissionLabel: String {
        switch authorizationStatus {
        case .authorized: "Allowed"
        case .denied: "Denied"
        case .provisional: "Provisional"
        case .ephemeral: "Ephemeral"
        case .notDetermined: "Not asked"
        @unknown default: "Unknown"
        }
    }

    private func toggle(_ categoryId: String) {
        errorMessage = nil
        successMessage = nil
        if selectedIds.contains(categoryId) {
            selectedIds.remove(categoryId)
            return
        }
        guard selectedIds.count < maxSelections else {
            errorMessage = "You can select at most \(maxSelections) categories."
            return
        }
        selectedIds.insert(categoryId)
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            async let categoriesResponse: APIEnvelope<[Category]> = auth.api.send(
                path: "categories",
                authenticated: false
            )
            async let preferencesResponse: APIEnvelope<NotificationPreferences> = auth.api.send(
                path: "notifications/preferences"
            )
            let (catalog, preferences) = try await (categoriesResponse, preferencesResponse)
            categories = catalog.data.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            selectedIds = Set(preferences.data.categoryIds)
            maxSelections = preferences.data.maxSelections
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func save() async {
        isSaving = true
        errorMessage = nil
        successMessage = nil
        do {
            let response: APIEnvelope<NotificationPreferences> = try await auth.api.send(
                "PUT",
                path: "notifications/preferences",
                body: UpdateNotificationPreferencesBody(categoryIds: Array(selectedIds).sorted())
            )
            selectedIds = Set(response.data.categoryIds)
            maxSelections = response.data.maxSelections
            successMessage = "Notification preferences saved."
            feedbackTrigger += 1
            PushDeviceRegistration.shared.startIfSignedIn()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }

    private func requestPermission() async {
        await PushDeviceRegistration.shared.requestAuthorizationAndRegister()
        await refreshPermissionStatus()
    }

    private func refreshPermissionStatus() async {
        authorizationStatus = await PushDeviceRegistration.shared.authorizationStatus()
    }
}

#Preview {
    NavigationStack {
        NotificationPreferencesView()
            .environment(AuthSession())
    }
}
