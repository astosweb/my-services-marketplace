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
                List { }
                    .overlay { ProgressView("Loading conversations") }
                    .refreshable { await load() }
            } else if let errorMessage, conversations.isEmpty {
                List { }
                    .overlay {
                        ContentUnavailableView {
                            Label("Couldn’t Load Messages", systemImage: "wifi.exclamationmark")
                        } description: {
                            Text(errorMessage)
                        } actions: {
                            Button("Retry") { Task { await load() } }
                                .buttonStyle(.borderedProminent)
                        }
                    }
                    .refreshable { await load() }
            } else if conversations.isEmpty {
                List { }
                    .overlay {
                        ContentUnavailableView(
                            showArchived ? "No Archived Messages" : "No Messages",
                            systemImage: "bubble.left.and.bubble.right",
                            description: Text(
                                showArchived
                                    ? "Archived conversations appear here."
                                    : "Message a post owner anytime — offers aren’t required."
                            )
                        )
                    }
                    .refreshable { await load() }
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
                .refreshable {
                    await load()
                    await auth.refreshInboxBadges()
                }
                .navigationDestination(for: Conversation.self) { conversation in
                    ConversationDetailView(conversation: conversation)
                }
            }
        }
        .navigationTitle("Messages")
        .notificationsToolbar()
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
                    Text(conversation.participant.profileName)
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
    @State private var fullscreenImage: ChatImagePreview?
    let conversation: Conversation

    var body: some View {
        VStack(spacing: 0) {
            chatParticipantHeader

            Divider()

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
            } else if messages.isEmpty {
                ContentUnavailableView(
                    "No Messages Yet",
                    systemImage: "bubble.left",
                    description: Text("Say hello to \(conversation.participant.profileName).")
                )
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 2) {
                            ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                                messageBubble(
                                    message,
                                    showSenderName: shouldShowSenderName(at: index),
                                    isGroupedWithNext: isGroupedWithNext(at: index)
                                )
                                .id(message.id)
                                .padding(.top, shouldShowSenderName(at: index) && index > 0 ? 10 : 0)
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                    }
                    .defaultScrollAnchor(.bottom)
                    .scrollDismissesKeyboard(.interactively)
                    .onChange(of: messages.count) {
                        if let id = messages.last?.id {
                            withAnimation(.easeOut(duration: 0.2)) {
                                proxy.scrollTo(id, anchor: .bottom)
                            }
                        }
                    }
                }
            }

            if let errorMessage, !messages.isEmpty {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
                    .padding(.top, 4)
                    .accessibilityAddTraits(.isStaticText)
            }

            messageComposer
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(conversation.requestTitle)
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $fullscreenImage) { item in
            ChatFullscreenImageViewer(url: item.url)
        }
        .task { await load() }
        .sensoryFeedback(.success, trigger: feedbackTrigger)
    }

    private var chatParticipantHeader: some View {
        HStack(spacing: 12) {
            avatar(for: conversation.participant, size: 40)

            VStack(alignment: .leading, spacing: 2) {
                Text(conversation.participant.profileName)
                    .font(.headline)
                    .lineLimit(1)
                Text(conversation.requestTitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.bar)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Chat with \(conversation.participant.profileName), \(conversation.requestTitle)")
    }

    private var messageComposer: some View {
        HStack(alignment: .bottom, spacing: 10) {
            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                Image(systemName: "photo")
                    .font(.title2)
                    .foregroundStyle(.secondary)
                    .frame(width: 36, height: 36)
            }
            .disabled(isSending)
            .accessibilityLabel("Attach photo")
            .onChange(of: selectedPhoto) {
                Task { await sendAttachment() }
            }

            TextField("Message", text: $draft, axis: .vertical)
                .lineLimit(1...10)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 22))
                .accessibilityLabel("Message")

            Button {
                Task { await send() }
            } label: {
                if isSending {
                    ProgressView()
                        .frame(width: 36, height: 36)
                } else {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 34))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(
                            draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                ? Color.secondary
                                : Color.accentColor
                        )
                }
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
            .accessibilityLabel("Send message")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(.bar)
    }

    private func shouldShowSenderName(at index: Int) -> Bool {
        guard messages.indices.contains(index) else { return false }
        let message = messages[index]
        let isMine = message.sender.id == auth.user?.id
        if isMine { return false }
        if index == 0 { return true }
        return messages[index - 1].sender.id != message.sender.id
    }

    private func isGroupedWithNext(at index: Int) -> Bool {
        guard messages.indices.contains(index),
              messages.indices.contains(index + 1)
        else { return false }
        return messages[index].sender.id == messages[index + 1].sender.id
    }

    private func messageBubble(
        _ message: Message,
        showSenderName: Bool,
        isGroupedWithNext: Bool
    ) -> some View {
        let isMine = message.sender.id == auth.user?.id
        let bubbleShape = UnevenRoundedRectangle(
            topLeadingRadius: 18,
            bottomLeadingRadius: isMine || isGroupedWithNext ? 18 : 6,
            bottomTrailingRadius: !isMine || isGroupedWithNext ? 18 : 6,
            topTrailingRadius: 18,
            style: .continuous
        )

        return HStack(alignment: .bottom, spacing: 8) {
            if isMine {
                Spacer(minLength: 56)
            } else {
                if isGroupedWithNext {
                    Color.clear.frame(width: 28, height: 28)
                } else {
                    avatar(for: message.sender, size: 28)
                }
            }

            VStack(alignment: isMine ? .trailing : .leading, spacing: 4) {
                if showSenderName {
                    Text(message.sender.profileName)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.leading, 4)
                }

                VStack(alignment: isMine ? .trailing : .leading, spacing: 6) {
                    if let attachment = message.attachment {
                        if attachment.mimeType.hasPrefix("image/") {
                            Button {
                                fullscreenImage = ChatImagePreview(url: attachment.url)
                            } label: {
                                AsyncImage(url: attachment.url) { image in
                                    image
                                        .resizable()
                                        .scaledToFit()
                                } placeholder: {
                                    ProgressView()
                                        .frame(width: 160, height: 120)
                                }
                                .frame(maxWidth: 240, maxHeight: 240)
                                .clipShape(.rect(cornerRadius: 14, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Photo")
                            .accessibilityHint("Shows full image")
                        } else {
                            Label(attachment.name, systemImage: "paperclip")
                                .font(.caption)
                        }
                    }
                    if !message.body.isEmpty {
                        Text(message.body)
                            .font(.body)
                            .foregroundStyle(isMine ? Color.white : Color.primary)
                            .multilineTextAlignment(.leading)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    isMine ? Color.accentColor : Color(.secondarySystemFill),
                    in: bubbleShape
                )

                HStack(spacing: 4) {
                    Text(message.createdAt, style: .time)
                    if isMine {
                        messageStatusTicks(message.status)
                    }
                }
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .padding(.horizontal, 4)
            }

            if !isMine { Spacer(minLength: 56) }
        }
        .padding(.bottom, isGroupedWithNext ? 2 : 8)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(messageAccessibilityLabel(message, isMine: isMine))
    }

    @ViewBuilder
    private func messageStatusTicks(_ status: MessageStatus) -> some View {
        let tickColor: Color = status == .read
            ? Color(red: 0.33, green: 0.73, blue: 0.95)
            : Color.secondary.opacity(0.75)

        Group {
            switch status {
            case .sending:
                Image(systemName: "clock")
            case .sent:
                Image(systemName: "checkmark")
            case .delivered, .read:
                ZStack(alignment: .leading) {
                    Image(systemName: "checkmark")
                    Image(systemName: "checkmark")
                        .offset(x: 4)
                }
                .frame(width: 12, alignment: .leading)
            }
        }
        .font(.caption2.weight(.bold))
        .foregroundStyle(tickColor)
        .accessibilityLabel(messageStatusAccessibilityLabel(status))
    }

    private func messageStatusAccessibilityLabel(_ status: MessageStatus) -> String {
        switch status {
        case .sending: "Sending"
        case .sent: "Sent"
        case .delivered: "Delivered"
        case .read: "Read"
        }
    }

    private func messageAccessibilityLabel(_ message: Message, isMine: Bool) -> String {
        let sender = isMine ? "You" : message.sender.profileName
        let body = message.body.isEmpty
            ? (message.attachment?.mimeType.hasPrefix("image/") == true ? "Photo" : "Attachment")
            : message.body
        if isMine {
            return "\(sender): \(body), \(messageStatusAccessibilityLabel(message.status))"
        }
        return "\(sender): \(body)"
    }

    private func load() async {
        isLoading = true
        do {
            let response: APIEnvelope<[Message]> = try await auth.api.send(
                path: "conversations/\(conversation.id)/messages"
            )
            messages = response.data
            errorMessage = nil
            let _: APIEnvelope<OKResponse>? = try? await auth.api.send(
                "POST",
                path: "conversations/\(conversation.id)/read"
            )
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
                  let jpeg = ImageUploadPrep.jpegData(from: image, kind: .messageAttachment)
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
    @State private var isLoading = true
    @State private var isUploadingAvatar = false
    @State private var selectedAvatar: PhotosPickerItem?
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var feedbackTrigger = 0
    @State private var showDeleteConfirm = false
    @State private var deletePassword = ""
    @State private var isDeletingAccount = false

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
                            Text(profile?.profileName ?? "")
                                .font(.title2.bold())
                            if let secondary = profile?.secondaryProfileName {
                                Text(secondary)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
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
                    NavigationLink {
                        EditProfileView()
                            .onDisappear {
                                Task { await refreshProfile() }
                            }
                    } label: {
                        Label("Edit Profile", systemImage: "person.text.rectangle")
                    }
                }

                Section("Notifications") {
                    NavigationLink {
                        NotificationPreferencesView()
                    } label: {
                        Label("Notification Preferences", systemImage: "bell.badge")
                    }
                }

                Section("Support") {
                    NavigationLink {
                        SupportView()
                    } label: {
                        Label("Help & Support", systemImage: "lifepreserver")
                    }
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
                    Button("Log Out", role: .destructive) {
                        Task { await auth.logout() }
                    }
                    .disabled(auth.isWorking)
                }

                Section {
                    Button("Delete Account", role: .destructive) {
                        deletePassword = ""
                        errorMessage = nil
                        showDeleteConfirm = true
                    }
                    .disabled(auth.isWorking || isDeletingAccount)
                }
            }
        }
        .navigationTitle("Profile")
        .notificationsToolbar()
        .task { await load() }
        .sensoryFeedback(.success, trigger: feedbackTrigger)
        .alert("Delete Account", isPresented: $showDeleteConfirm) {
            SecureField("Password", text: $deletePassword)
            Button("Delete", role: .destructive) {
                Task { await deleteAccount() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently deletes your account and associated data. Enter your password to confirm.")
        }
    }

    private func deleteAccount() async {
        let password = deletePassword
        guard !password.isEmpty else {
            errorMessage = "Password is required to delete your account."
            return
        }
        isDeletingAccount = true
        defer { isDeletingAccount = false }
        let ok = await auth.deleteAccount(password: password)
        if !ok {
            errorMessage = auth.errorMessage ?? "Could not delete account."
        }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            let profileResponse: APIEnvelope<User> = try await auth.api.send(path: "auth/me")
            profile = profileResponse.data
            auth.updateUser(profileResponse.data)

            let statsResponse: APIEnvelope<ProfileStats> = try await auth.api.send(path: "auth/me/stats")
            stats = statsResponse.data
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func refreshProfile() async {
        do {
            let profileResponse: APIEnvelope<User> = try await auth.api.send(path: "auth/me")
            profile = profileResponse.data
            auth.updateUser(profileResponse.data)
        } catch {
            // Keep showing the last known profile if refresh fails.
        }
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
                  let jpeg = ImageUploadPrep.jpegData(from: image, kind: .avatar)
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

struct UserProfileView: View {
    @Environment(AuthSession.self) private var auth

    let userId: String
    var requestId: String?
    var requestTitle: String?
    var categoryId: String?
    var categoryName: String?
    var categorySymbol: String?

    @State private var profile: OfferUser?
    @State private var reviews: [Review] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var isOpeningChat = false
    @State private var conversationId: String?

    private var isSelf: Bool {
        auth.user?.id == userId
    }

    private var canMessage: Bool {
        auth.user != nil && !isSelf && requestId != nil
    }

    var body: some View {
        Group {
            if isLoading && profile == nil {
                ProgressView("Loading profile")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage, profile == nil {
                ContentUnavailableView {
                    Label("Couldn’t Load Profile", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(errorMessage)
                } actions: {
                    Button("Retry") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if let profile {
                List {
                    Section {
                        HStack(spacing: 16) {
                            avatar(for: profile)
                                .scaleEffect(1.35)
                                .frame(width: 60, height: 60)

                            VStack(alignment: .leading, spacing: 4) {
                                Text(profile.profileName)
                                    .font(.title2.bold())
                                if let secondary = profile.secondaryProfileName {
                                    Text(secondary)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                                Label(
                                    String(format: "%.1f · %d reviews", profile.rating, profile.reviewCount),
                                    systemImage: "star.fill"
                                )
                                .font(.caption)
                                .foregroundStyle(.orange)
                                Text("Member since \(profile.memberSince.formatted(.dateTime.year()))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 8)

                        if let bio = profile.bio, !bio.isEmpty {
                            Text(bio)
                                .font(.body)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if canMessage {
                        Section {
                            Button {
                                Task { await openConversation() }
                            } label: {
                                if isOpeningChat {
                                    ProgressView()
                                        .frame(maxWidth: .infinity)
                                } else {
                                    Label("Message \(profile.profileName)", systemImage: "bubble.left.and.bubble.right.fill")
                                        .frame(maxWidth: .infinity)
                                }
                            }
                            .disabled(isOpeningChat)
                        }
                    }

                    if let errorMessage {
                        Section {
                            Label(errorMessage, systemImage: "exclamationmark.circle.fill")
                                .foregroundStyle(.red)
                        }
                    }

                    Section("Reviews") {
                        if reviews.isEmpty {
                            Text("No reviews yet")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(reviews) { review in
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack {
                                        Text(review.author.profileName)
                                            .font(.subheadline.weight(.semibold))
                                        Spacer(minLength: 0)
                                        Label("\(review.rating)", systemImage: "star.fill")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(.orange)
                                    }
                                    if let body = review.body, !body.isEmpty {
                                        Text(body)
                                            .font(.subheadline)
                                            .foregroundStyle(.secondary)
                                    }
                                    HStack(spacing: 6) {
                                        if let title = review.request?.title {
                                            Text(title)
                                                .lineLimit(1)
                                        }
                                        Text(review.createdAt.formatted(date: .abbreviated, time: .omitted))
                                    }
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                                }
                                .padding(.vertical, 2)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(profile?.profileName ?? "Profile")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .navigationDestination(item: $conversationId) { id in
            if let profile {
                ConversationDetailView(
                    conversation: Conversation(
                        id: id,
                        requestId: requestId ?? "",
                        requestTitle: requestTitle ?? "Request",
                        categoryId: categoryId ?? "",
                        categoryName: categoryName ?? "",
                        categorySymbol: categorySymbol ?? "person.fill",
                        participant: profile,
                        lastMessage: nil,
                        updatedAt: Date(),
                        unreadCount: 0,
                        isPinned: false,
                        isArchived: false
                    )
                )
            }
        }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            let loadedProfile: APIEnvelope<OfferUser> = try await auth.api.send(
                path: "users/\(userId)",
                authenticated: false
            )
            let loadedReviews: APIEnvelope<[Review]> = try await auth.api.send(
                path: "users/\(userId)/reviews",
                authenticated: false
            )
            profile = loadedProfile.data
            reviews = loadedReviews.data
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func openConversation() async {
        guard let requestId else { return }
        isOpeningChat = true
        errorMessage = nil
        do {
            let response: APIEnvelope<RequestConversationPayload> = try await auth.api.send(
                "POST",
                path: "requests/\(requestId)/conversation",
                query: [URLQueryItem(name: "peerUserId", value: userId)],
                body: OpenConversationBody(peerUserId: userId)
            )
            if let id = response.data.id {
                conversationId = id
            } else {
                errorMessage = "Couldn’t open chat."
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isOpeningChat = false
    }
}

private struct ChatImagePreview: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

private struct ChatFullscreenImageViewer: View {
    @Environment(\.dismiss) private var dismiss
    let url: URL
    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFit()
                        .scaleEffect(scale)
                        .gesture(
                            MagnifyGesture()
                                .onChanged { value in
                                    scale = max(1, min(lastScale * value.magnification, 4))
                                }
                                .onEnded { _ in
                                    lastScale = scale
                                    if scale < 1.05 {
                                        withAnimation(.easeOut(duration: 0.2)) {
                                            scale = 1
                                            lastScale = 1
                                        }
                                    }
                                }
                        )
                        .onTapGesture(count: 2) {
                            withAnimation(.easeOut(duration: 0.2)) {
                                if scale > 1 {
                                    scale = 1
                                    lastScale = 1
                                } else {
                                    scale = 2.5
                                    lastScale = 2.5
                                }
                            }
                        }
                case .failure:
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundStyle(.white.opacity(0.7))
                        .accessibilityLabel("Couldn’t load image")
                default:
                    ProgressView()
                        .tint(.white)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .overlay(alignment: .topTrailing) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title)
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(.white)
                    .padding(16)
            }
            .accessibilityLabel("Close")
        }
        .statusBarHidden()
    }
}

@ViewBuilder
private func avatar(for user: OfferUser, size: CGFloat = 44) -> some View {
    if let url = user.avatarUrl {
        AsyncImage(url: url) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Image(systemName: "person.fill")
                .font(.system(size: size * 0.4))
        }
        .frame(width: size, height: size)
        .clipShape(.circle)
    } else {
        Image(systemName: "person.fill")
            .font(.system(size: size * 0.4))
            .foregroundStyle(.secondary)
            .frame(width: size, height: size)
            .background(.thinMaterial, in: .circle)
    }
}

@ViewBuilder
private func avatar(for user: User, size: CGFloat = 44) -> some View {
    if let url = user.avatarUrl {
        AsyncImage(url: url) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Image(systemName: "person.fill")
                .font(.system(size: size * 0.4))
        }
        .frame(width: size, height: size)
        .clipShape(.circle)
    } else {
        Image(systemName: "person.fill")
            .font(.system(size: size * 0.4))
            .foregroundStyle(.secondary)
            .frame(width: size, height: size)
            .background(.thinMaterial, in: .circle)
    }
}

#Preview("Messages") {
    NavigationStack {
        ConversationsView()
    }
    .environment(AuthSession())
}
