import SwiftUI

struct EditProfileView: View {
    @Environment(AuthSession.self) private var auth

    @State private var displayName = ""
    @State private var businessName = ""
    @State private var preferBusinessName = true
    @State private var bio = ""
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var feedbackTrigger = 0

    var body: some View {
        Form {
            if isLoading {
                ProgressView("Loading profile")
                    .frame(maxWidth: .infinity)
            } else {
                Section {
                    TextField("Display name", text: $displayName)
                        .textContentType(.name)
                    TextField("Business name", text: $businessName)
                        .textContentType(.organizationName)
                    if !businessName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Toggle("Show business name publicly", isOn: $preferBusinessName)
                    }
                    TextField("Bio", text: $bio, axis: .vertical)
                        .lineLimit(3...8)
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.circle.fill")
                            .foregroundStyle(.red)
                            .accessibilityAddTraits(.isStaticText)
                    }
                }
                if let successMessage {
                    Section {
                        Label(successMessage, systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                            .accessibilityAddTraits(.isStaticText)
                    }
                }

                Section {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving { ProgressView() } else { Text("Save Changes") }
                    }
                    .disabled(displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                }
            }
        }
        .navigationTitle("Edit Profile")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .sensoryFeedback(.success, trigger: feedbackTrigger)
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            let response: APIEnvelope<User> = try await auth.api.send(path: "auth/me")
            displayName = response.data.displayName
            businessName = response.data.businessName ?? ""
            preferBusinessName = response.data.preferBusinessName
            bio = response.data.bio ?? ""
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
            let response: APIEnvelope<User> = try await auth.api.send(
                "PATCH",
                path: "auth/me",
                body: ProfileUpdate(
                    displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines),
                    businessName: businessName.trimmingCharacters(in: .whitespacesAndNewlines),
                    preferBusinessName: preferBusinessName,
                    bio: bio.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            )
            auth.updateUser(response.data)
            successMessage = "Profile updated."
            feedbackTrigger += 1
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }
}

#Preview {
    NavigationStack {
        EditProfileView()
            .environment(AuthSession())
    }
}
