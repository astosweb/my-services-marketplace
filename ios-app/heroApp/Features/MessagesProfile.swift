import PhotosUI
import SwiftUI
import UIKit

struct ConversationsView: View {
    @Environment(AuthSession.self) private var auth
    @State private var conversations: [Conversation] = []
    @State private var showArchived = false
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            if isLoading && conversations.isEmpty {
                ProgressView("Loading conversations")
            } else if let errorMessage, conversations.isEmpty {
                ContentUnavailableView {
                    Label("Couldn’t Load Messages", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(errorMessage)
                } actions: {
                    Button("Retry") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if conversations.isEmpty {
                ContentUnavailableView(
                    showArchived ? "No Archived Messages" : "No Messages",
                    systemImage: "bubble.left.and.bubble.right",
                    description: Text(
                        showArchived
                            ? "Archived conversations appear here."
                            : "Message a post owner anytime — offers aren’t required."
                    )
                )
            } else {
                List {
                    ForEach(conversations) { conversation in
                        NavigationLink(value: conversation) {
                            conversationRow(conversation)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button {
                                Task { await setArchived(conversation, archived: !showArchived) }
                            } label: {
                                Label(showArchived ? "Unarchive" : "Archive", systemImage: showArchived ? "tray.and.arrow.up" : "archivebox")
                            }
                            .tint(.orange)
                        }
                        .swipeActions(edge: .leading) {
                            Button {
                                Task { await setPinned(conversation, pinned: !conversation.isPinned) }
                            } label: {
                                Label(
                                    conversation.isPinned ? "Unpin" : "Pin",
                                    systemImage: conversation.isPinned ? "pin.slash" : "pin"
                                )
                            }
                            .tint(.blue)
                        }
                    }
                }
                .listStyle(.plain)
                .refreshable { await load() }
                .navigationDestination(for: Conversation.self) { conversation in
                    ConversationDetailView(conversation: conversation)
                }
            }
        }
        .navigationTitle("Messages")
        .notificationsToolbar(showsMessages: false)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button(showArchived ? "Inbox" : "Archived") {
                    showArchived.toggle()
                    Task { await load() }
                }
            }
        }
        .task(id: showArchived) { await load() }
    }

    private func conversationRow(_ conversation: Conversation) -> some View {
        HStack(spacing: 12) {
            avatar(for: conversation.participant)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    if conversation.isPinned {
                        Image(systemName: "pin.fill")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    Text(conversation.participant.displayName)
                        .font(.headline)
                    Spacer()
                    Text(conversation.updatedAt, style: .relative)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text(conversation.requestTitle)
                    .font(.subheadline)
                Text(conversation.lastMessage?.body ?? "No messages yet")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            if conversation.unreadCount > 0 {
                Text("\(conversation.unreadCount)")
                    .font(.caption.bold())
                    .foregroundStyle(.white)
                    .padding(6)
                    .background(.tint, in: .circle)
                    .accessibilityLabel("\(conversation.unreadCount) unread")
            }
        }
        .padding(.vertical, 4)
    }

    private func load() async {
        isLoading = true
        do {
            let response: PaginatedEnvelope<[Conversation], ConversationMeta> = try await auth.api.send(
                path: "conversations",
                query: showArchived
                    ? [URLQueryItem(name: "archived", value: "true")]
                    : []
            )
            withAnimation { conversations = response.data }
            if !showArchived {
                auth.messageUnreadCount = response.meta.unreadCount
            }
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func setArchived(_ conversation: Conversation, archived: Bool) async {
        let _: APIEnvelope<ConversationActionResponse>? = try? await auth.api.send(
            "PATCH",
            path: "conversations/\(conversation.id)/archive",
            body: ArchiveConversationBody(isArchived: archived)
        )
        await load()
    }

    private func setPinned(_ conversation: Conversation, pinned: Bool) async {
        let _: APIEnvelope<ConversationActionResponse>? = try? await auth.api.send(
            "PATCH",
            path: "conversations/\(conversation.id)/pin",
            body: PinConversationBody(isPinned: pinned)
        )
        await load()
    }
}

struct ConversationDetailView: View {
    @Environment(AuthSession.self) private var auth
    @State private var messages: [Message] = []
    @State private var draft = ""
    @State private var isLoading = true
    @State private var isSending = false
    @State private var errorMessage: String?
    @State private var feedbackTrigger = 0
    @State private var selectedPhoto: PhotosPickerItem?
    let conversation: Conversation

    var body: some View {
        VStack(spacing: 0) {
            if isLoading && messages.isEmpty {
                Spacer()
                ProgressView("Loading messages")
                Spacer()
            } else if let errorMessage, messages.isEmpty {
                ContentUnavailableView {
                    Label("Couldn’t Load Conversation", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(errorMessage)
                } actions: {
                    Button("Retry") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(messages) { message in
                                messageBubble(message)
                                    .id(message.id)
                            }
                        }
                        .padding()
                    }
                    .onChange(of: messages.count) {
                        if let id = messages.last?.id {
                            withAnimation { proxy.scrollTo(id, anchor: .bottom) }
                        }
                    }
                }
            }

            if let errorMessage, !messages.isEmpty {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
                    .accessibilityAddTraits(.isStaticText)
            }

            HStack(alignment: .bottom, spacing: 10) {
                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    Image(systemName: "photo")
                        .font(.title3)
                }
                .disabled(isSending)
                .accessibilityLabel("Attach photo")
                .onChange(of: selectedPhoto) {
                    Task { await sendAttachment() }
                }

                TextField("Message", text: $draft, axis: .vertical)
                    .lineLimit(1...5)
                    .textFieldStyle(.roundedBorder)
                Button {
                    Task { await send() }
                } label: {
                    if isSending {
                        ProgressView()
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title)
                    }
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
                .accessibilityLabel("Send message")
            }
            .padding()
            .background(.bar)
        }
        .navigationTitle(conversation.participant.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .sensoryFeedback(.success, trigger: feedbackTrigger)
    }

    private func messageBubble(_ message: Message) -> some View {
        let isMine = message.sender.id == auth.user?.id
        return HStack {
            if isMine { Spacer(minLength: 50) }
            VStack(alignment: isMine ? .trailing : .leading, spacing: 6) {
                if let attachment = message.attachment {
                    if attachment.mimeType.hasPrefix("image/") {
                        AsyncImage(url: attachment.url) { image in
                            image
                                .resizable()
                                .scaledToFit()
                        } placeholder: {
                            ProgressView()
                        }
                        .frame(maxWidth: 220, maxHeight: 220)
                        .clipShape(.rect(cornerRadius: 12))
                    } else {
                        Label(attachment.name, systemImage: "paperclip")
                            .font(.caption)
                    }
                }
                if !message.body.isEmpty {
                    Text(message.body)
                }
                HStack(spacing: 4) {
                    Text(message.createdAt, style: .time)
                    if isMine {
                        Text(message.status == .read ? "Read" : "Sent")
                    }
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(
                isMine ? Color.accentColor.opacity(0.22) : Color.secondary.opacity(0.12),
                in: .rect(cornerRadius: 16)
            )
            if !isMine { Spacer(minLength: 50) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(isMine ? "You" : message.sender.displayName): \(message.body)")
    }

    private func load() async {
        isLoading = true
        do {
            let response: APIEnvelope<[Message]> = try await auth.api.send(
                path: "conversations/\(conversation.id)/messages"
            )
            messages = response.data
            errorMessage = nil
            await auth.refreshInboxBadges()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func send() async {
        let body = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        isSending = true
        errorMessage = nil
        do {
            let response: APIEnvelope<Message> = try await auth.api.send(
                "POST",
                path: "conversations/\(conversation.id)/messages",
                body: SendMessageRequest(body: body)
            )
            messages.append(response.data)
            draft = ""
            feedbackTrigger += 1
        } catch {
            errorMessage = error.localizedDescription
        }
        isSending = false
    }

    private func sendAttachment() async {
        guard let selectedPhoto else { return }
        isSending = true
        errorMessage = nil
        defer {
            self.selectedPhoto = nil
            isSending = false
        }
        do {
            guard let data = try await selectedPhoto.loadTransferable(type: Data.self),
                  let image = UIImage(data: data),
                  let jpeg = image.jpegData(compressionQuality: 0.82)
            else {
                errorMessage = "Couldn’t read the selected photo."
                return
            }
            let upload: APIEnvelope<UploadAttachmentResponse> = try await auth.api.uploadMultipart(
                path: "uploads/message-attachments",
                fieldName: "file",
                filename: "attachment.jpg",
                mimeType: "image/jpeg",
                fileData: jpeg
            )
            let caption = draft.trimmingCharacters(in: .whitespacesAndNewlines)
            let response: APIEnvelope<Message> = try await auth.api.send(
                "POST",
                path: "conversations/\(conversation.id)/messages",
                body: SendMessageRequest(
                    body: caption.isEmpty ? nil : caption,
                    attachmentKey: upload.data.key,
                    attachmentName: upload.data.name,
                    attachmentMimeType: upload.data.mimeType
                )
            )
            messages.append(response.data)
            draft = ""
            feedbackTrigger += 1
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct ProfileView: View {
    @Environment(AuthSession.self) private var auth
    @State private var profile: User?
    @State private var stats: ProfileStats?
    @State private var displayName = ""
    @State private var bio = ""
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var isUploadingAvatar = false
    @State private var selectedAvatar: PhotosPickerItem?
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var feedbackTrigger = 0

    var body: some View {
        Form {
            if isLoading && profile == nil {
                ProgressView("Loading profile")
                    .frame(maxWidth: .infinity)
            } else {
                Section {
                    HStack(spacing: 16) {
                        PhotosPicker(selection: $selectedAvatar, matching: .images) {
                            ZStack(alignment: .bottomTrailing) {
                                if let profile {
                                    avatar(for: profile)
                                        .scaleEffect(1.35)
                                }
                                if isUploadingAvatar {
                                    ProgressView()
                                        .padding(4)
                                        .background(.regularMaterial, in: .circle)
                                } else {
                                    Image(systemName: "camera.fill")
                                        .font(.caption2)
                                        .padding(5)
                                        .background(.tint, in: .circle)
                                        .foregroundStyle(.white)
                                }
                            }
                        }
                        .disabled(isUploadingAvatar)
                        .onChange(of: selectedAvatar) {
                            Task { await uploadAvatar() }
                        }
                        .accessibilityLabel("Change profile photo")

                        VStack(alignment: .leading) {
                            Text(profile?.displayName ?? "")
                                .font(.title2.bold())
                            Text(profile?.email ?? "")
                                .foregroundStyle(.secondary)
                            Label(
                                String(format: "%.1f · %d reviews", profile?.rating ?? 0, profile?.reviewCount ?? 0),
                                systemImage: "star.fill"
                            )
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 8)
                }

                if let stats {
                    Section("Activity") {
                        LabeledContent("Posted", value: "\(stats.postedCount)")
                        LabeledContent("Completed", value: "\(stats.completedCount)")
                        LabeledContent("Reviews", value: "\(stats.reviewCount)")
                    }
                }

                Section("Edit Profile") {
                    TextField("Display name", text: $displayName)
                        .textContentType(.name)
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

                    Button("Log Out", role: .destructive) {
                        Task { await auth.logout() }
                    }
                    .disabled(auth.isWorking)
                }
            }
        }
        .navigationTitle("Profile")
        .notificationsToolbar()
        .task { await load() }
        .sensoryFeedback(.success, trigger: feedbackTrigger)
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            let profileResponse: APIEnvelope<User> = try await auth.api.send(path: "auth/me")
            profile = profileResponse.data
            displayName = profileResponse.data.displayName
            bio = profileResponse.data.bio ?? ""
            auth.updateUser(profileResponse.data)

            let statsResponse: APIEnvelope<ProfileStats> = try await auth.api.send(path: "auth/me/stats")
            stats = statsResponse.data
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
                    bio: bio.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            )
            profile = response.data
            auth.updateUser(response.data)
            successMessage = "Profile updated."
            feedbackTrigger += 1
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }

    private func uploadAvatar() async {
        guard let selectedAvatar else { return }
        isUploadingAvatar = true
        errorMessage = nil
        successMessage = nil
        defer {
            self.selectedAvatar = nil
            isUploadingAvatar = false
        }
        do {
            guard let data = try await selectedAvatar.loadTransferable(type: Data.self),
                  let image = UIImage(data: data),
                  let jpeg = image.jpegData(compressionQuality: 0.85)
            else {
                errorMessage = "Couldn’t read the selected photo."
                return
            }
            let upload: APIEnvelope<UploadAvatarResponse> = try await auth.api.uploadMultipart(
                path: "uploads/avatars",
                fieldName: "file",
                filename: "avatar.jpg",
                mimeType: "image/jpeg",
                fileData: jpeg
            )
            let response: APIEnvelope<User> = try await auth.api.send(
                "PATCH",
                path: "auth/me",
                body: ProfileUpdate(avatarKey: upload.data.key)
            )
            profile = response.data
            auth.updateUser(response.data)
            successMessage = "Profile photo updated."
            feedbackTrigger += 1
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

@ViewBuilder
private func avatar(for user: OfferUser) -> some View {
    if let url = user.avatarUrl {
        AsyncImage(url: url) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Image(systemName: "person.fill")
        }
        .frame(width: 44, height: 44)
        .clipShape(.circle)
    } else {
        Image(systemName: "person.fill")
            .foregroundStyle(.secondary)
            .frame(width: 44, height: 44)
            .background(.thinMaterial, in: .circle)
    }
}

@ViewBuilder
private func avatar(for user: User) -> some View {
    if let url = user.avatarUrl {
        AsyncImage(url: url) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Image(systemName: "person.fill")
        }
        .frame(width: 44, height: 44)
        .clipShape(.circle)
    } else {
        Image(systemName: "person.fill")
            .foregroundStyle(.secondary)
            .frame(width: 44, height: 44)
            .background(.thinMaterial, in: .circle)
    }
}

#Preview("Messages") {
    NavigationStack {
        ConversationsView()
    }
    .environment(AuthSession())
}
