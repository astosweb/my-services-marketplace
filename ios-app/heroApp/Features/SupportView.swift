import PhotosUI
import SwiftUI
import UIKit

struct SupportView: View {
    private static let pageSize = 30

    @Environment(AuthSession.self) private var auth
    @State private var tickets: [SupportTicket] = []
    @State private var searchText = ""
    @State private var statusFilter: SupportTicketStatus?
    @State private var totalCount = 0
    @State private var isLoading = true
    @State private var isLoadingMore = false
    @State private var errorMessage: String?
    @State private var isCreatingTicket = false

    private var query: SupportListQuery {
        SupportListQuery(
            caseNumber: searchText.trimmingCharacters(in: .whitespacesAndNewlines),
            status: statusFilter
        )
    }

    var body: some View {
        Group {
            if isLoading && tickets.isEmpty {
                List { }
                    .overlay { ProgressView("Loading support tickets") }
                    .refreshable { await load() }
            } else if let errorMessage, tickets.isEmpty {
                List { }
                    .overlay {
                        ContentUnavailableView {
                            Label("Couldn’t Load Support", systemImage: "wifi.exclamationmark")
                        } description: {
                            Text(errorMessage)
                        } actions: {
                            Button("Retry") { Task { await load() } }
                                .buttonStyle(.borderedProminent)
                        }
                    }
                    .refreshable { await load() }
            } else if tickets.isEmpty {
                List { }
                    .overlay {
                        ContentUnavailableView {
                            Label(emptyTitle, systemImage: emptySystemImage)
                        } description: {
                            Text(emptyDescription)
                        } actions: {
                            if query.hasFilters {
                                Button("Clear Filters") {
                                    searchText = ""
                                    statusFilter = nil
                                }
                                .buttonStyle(.bordered)
                            } else {
                                Button("Contact Support") {
                                    isCreatingTicket = true
                                }
                                .buttonStyle(.borderedProminent)
                            }
                        }
                    }
                    .refreshable { await load() }
            } else {
                List {
                    if let errorMessage {
                        Section {
                            Label(errorMessage, systemImage: "exclamationmark.circle.fill")
                                .font(.footnote)
                                .foregroundStyle(.red)
                        }
                    }

                    ForEach(tickets) { ticket in
                        NavigationLink {
                            SupportTicketDetailView(ticket: ticket) { updated in
                                update(updated)
                            }
                        } label: {
                            ticketRow(ticket)
                        }
                        .task {
                            if ticket.id == tickets.last?.id {
                                await loadMore()
                            }
                        }
                    }

                    if isLoadingMore {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .listRowSeparator(.hidden)
                    }
                }
                .listStyle(.plain)
                .refreshable { await load() }
            }
        }
        .navigationTitle("Help & Support")
        .searchable(text: $searchText, prompt: "Search case number")
        .textInputAutocapitalization(.characters)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                statusMenu
                Button {
                    isCreatingTicket = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("New support ticket")
            }
        }
        .sheet(isPresented: $isCreatingTicket) {
            NavigationStack {
                CreateSupportTicketView { created in
                    guard statusFilter == nil || statusFilter == created.status else { return }
                    withAnimation(.snappy) {
                        tickets.removeAll { $0.id == created.id }
                        tickets.insert(created, at: 0)
                        totalCount += 1
                    }
                }
            }
        }
        .task(id: query) {
            if !query.caseNumber.isEmpty {
                try? await Task.sleep(for: .milliseconds(300))
            }
            guard !Task.isCancelled else { return }
            await load()
        }
    }

    private var statusMenu: some View {
        Menu {
            Button {
                statusFilter = nil
            } label: {
                if statusFilter == nil {
                    Label("All Statuses", systemImage: "checkmark")
                } else {
                    Text("All Statuses")
                }
            }

            ForEach(SupportTicketStatus.allCases) { status in
                Button {
                    statusFilter = status
                } label: {
                    if statusFilter == status {
                        Label(status.displayName, systemImage: "checkmark")
                    } else {
                        Text(status.displayName)
                    }
                }
            }
        } label: {
            Image(systemName: statusFilter == nil ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
        }
        .accessibilityLabel(statusFilter.map { "Status filter, \($0.displayName)" } ?? "Status filter, all")
    }

    private func ticketRow(_ ticket: SupportTicket) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 8) {
                Text(ticket.caseNumber)
                    .font(.caption.monospaced().weight(.semibold))
                    .foregroundStyle(.secondary)
                if ticket.unreadCount > 0 {
                    Text("\(ticket.unreadCount)")
                        .font(.caption2.bold())
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(.tint, in: .capsule)
                        .accessibilityLabel("\(ticket.unreadCount) unread replies")
                }
                Spacer(minLength: 8)
                Text(ticket.lastMessageAt ?? ticket.updatedAt, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            Text(ticket.subject)
                .font(.headline)
                .lineLimit(2)
                .fontWeight(ticket.unreadCount > 0 ? .bold : .semibold)

            HStack(spacing: 8) {
                Label(ticket.category.displayName, systemImage: ticket.category.systemImage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer(minLength: 4)
                SupportStatusBadge(status: ticket.status)
            }

            if let attachmentCount = ticket.attachmentCount, attachmentCount > 0 {
                Label("\(attachmentCount) attachment\(attachmentCount == 1 ? "" : "s")", systemImage: "paperclip")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 5)
        .animation(.snappy(duration: 0.2), value: ticket.status)
    }

    private var emptyTitle: String {
        query.hasFilters ? "No Matching Tickets" : "No Support Tickets"
    }

    private var emptySystemImage: String {
        query.hasFilters ? "magnifyingglass" : "lifepreserver"
    }

    private var emptyDescription: String {
        query.hasFilters
            ? "Try another case number or status."
            : "Contact support and your conversations will appear here."
    }

    private func load() async {
        let requestedQuery = query
        isLoading = true
        errorMessage = nil
        do {
            let response: PaginatedEnvelope<[SupportTicket], PageMeta> = try await auth.api.send(
                path: "support/tickets",
                query: queryItems(for: requestedQuery, offset: 0)
            )
            guard !Task.isCancelled, requestedQuery == query else { return }
            withAnimation(.snappy) {
                tickets = response.data
                totalCount = response.meta.total
            }
        } catch {
            guard !Task.isCancelled, requestedQuery == query else { return }
            errorMessage = error.localizedDescription
        }
        if requestedQuery == query {
            isLoading = false
        }
    }

    private func loadMore() async {
        guard !isLoading, !isLoadingMore, tickets.count < totalCount else { return }
        let requestedQuery = query
        let offset = tickets.count
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let response: PaginatedEnvelope<[SupportTicket], PageMeta> = try await auth.api.send(
                path: "support/tickets",
                query: queryItems(for: requestedQuery, offset: offset)
            )
            guard !Task.isCancelled, requestedQuery == query else { return }
            let existingIDs = Set(tickets.map(\.id))
            withAnimation(.snappy) {
                tickets.append(contentsOf: response.data.filter { !existingIDs.contains($0.id) })
                totalCount = response.meta.total
            }
            errorMessage = nil
        } catch {
            guard !Task.isCancelled, requestedQuery == query else { return }
            errorMessage = error.localizedDescription
        }
    }

    private func queryItems(for query: SupportListQuery, offset: Int) -> [URLQueryItem] {
        var items = [
            URLQueryItem(name: "limit", value: "\(Self.pageSize)"),
            URLQueryItem(name: "offset", value: "\(offset)"),
            URLQueryItem(name: "sortBy", value: "updatedAt"),
            URLQueryItem(name: "sortOrder", value: "desc")
        ]
        if !query.caseNumber.isEmpty {
            items.append(URLQueryItem(name: "caseNumber", value: query.caseNumber))
        }
        if let status = query.status {
            items.append(URLQueryItem(name: "status", value: status.rawValue))
        }
        return items
    }

    private func update(_ updated: SupportTicket) {
        withAnimation(.snappy) {
            if let index = tickets.firstIndex(where: { $0.id == updated.id }) {
                if statusFilter == nil || statusFilter == updated.status {
                    tickets[index] = updated
                } else {
                    tickets.remove(at: index)
                    totalCount = max(0, totalCount - 1)
                }
            }
        }
    }
}

struct CreateSupportTicketView: View {
    private static let maxAttachments = 9

    @Environment(AuthSession.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @State private var category: SupportTicketCategory = .other
    @State private var priority: SupportTicketPriority = .normal
    @State private var subject = ""
    @State private var description = ""
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var attachments: [SupportDraftImage] = []
    @State private var isPreparingAttachments = false
    @State private var isSubmitting = false
    @State private var uploadProgress: Double = 0
    @State private var errorMessage: String?

    let onCreated: (SupportTicket) -> Void

    private var trimmedSubject: String {
        subject.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var trimmedDescription: String {
        description.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canSubmit: Bool {
        trimmedSubject.count >= 3
            && trimmedDescription.count >= 10
            && !isPreparingAttachments
            && !isSubmitting
    }

    var body: some View {
        Form {
            Section("Issue") {
                Picker("Category", selection: $category) {
                    ForEach(SupportTicketCategory.allCases) { option in
                        Label(option.displayName, systemImage: option.systemImage)
                            .tag(option)
                    }
                }

                Picker("Priority", selection: $priority) {
                    ForEach(SupportTicketPriority.allCases) { option in
                        Text(option.displayName).tag(option)
                    }
                }

                TextField("Subject", text: $subject, prompt: Text("Briefly describe the issue"))
                    .textInputAutocapitalization(.sentences)

                TextField(
                    "Description",
                    text: $description,
                    prompt: Text("Tell us what happened and how we can help"),
                    axis: .vertical
                )
                .lineLimit(5...12)
                .textInputAutocapitalization(.sentences)
            }

            Section {
                if attachments.isEmpty {
                    Label("No photos selected", systemImage: "photo.on.rectangle.angled")
                        .foregroundStyle(.secondary)
                } else {
                    ScrollView(.horizontal) {
                        HStack(spacing: 10) {
                            ForEach(attachments) { attachment in
                                draftThumbnail(attachment)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                    .scrollIndicators(.hidden)
                }

                if attachments.count < Self.maxAttachments {
                    PhotosPicker(
                        selection: $selectedPhotos,
                        maxSelectionCount: Self.maxAttachments - attachments.count,
                        matching: .images
                    ) {
                        Label(
                            attachments.isEmpty ? "Add Photos" : "Add More Photos",
                            systemImage: "photo.badge.plus"
                        )
                    }
                    .disabled(isPreparingAttachments || isSubmitting)
                }

                if isPreparingAttachments {
                    ProgressView("Preparing photos")
                }

                if isSubmitting && !attachments.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(uploadProgress < 1 ? "Uploading photos…" : "Creating ticket…")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        ProgressView(value: uploadProgress)
                    }
                }
            } header: {
                Text("Attachments")
            } footer: {
                Text("Optional. Add up to \(Self.maxAttachments) photos.")
            }

            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.circle.fill")
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("Contact Support")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
                    .disabled(isSubmitting)
            }
            ToolbarItem(placement: .confirmationAction) {
                Button {
                    Task { await submit() }
                } label: {
                    if isSubmitting {
                        ProgressView()
                    } else {
                        Text("Submit")
                            .fontWeight(.semibold)
                    }
                }
                .disabled(!canSubmit)
            }
        }
        .interactiveDismissDisabled(isSubmitting)
        .onChange(of: selectedPhotos) {
            Task { await prepareSelectedPhotos() }
        }
    }

    private func draftThumbnail(_ attachment: SupportDraftImage) -> some View {
        ZStack(alignment: .topTrailing) {
            if let image = UIImage(data: attachment.jpegData) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 84, height: 84)
                    .clipShape(.rect(cornerRadius: 10))
            }

            Button {
                withAnimation(.snappy) {
                    attachments.removeAll { $0.id == attachment.id }
                }
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(.white, .black.opacity(0.6))
                    .font(.title3)
            }
            .buttonStyle(.plain)
            .offset(x: 5, y: -5)
            .disabled(isSubmitting)
            .accessibilityLabel("Remove photo")
        }
        .frame(width: 88, height: 88)
    }

    private func prepareSelectedPhotos() async {
        let items = selectedPhotos
        guard !items.isEmpty else { return }
        isPreparingAttachments = true
        errorMessage = nil
        defer {
            selectedPhotos = []
            isPreparingAttachments = false
        }

        var prepared: [SupportDraftImage] = []
        for item in items {
            guard attachments.count + prepared.count < Self.maxAttachments else { break }
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data),
               let jpeg = ImageUploadPrep.jpegData(from: image, kind: .supportAttachment) {
                prepared.append(SupportDraftImage(jpegData: jpeg))
            }
        }
        guard !prepared.isEmpty else {
            errorMessage = "Couldn’t read the selected photos."
            return
        }
        withAnimation(.snappy) {
            attachments.append(contentsOf: prepared)
        }
    }

    private func submit() async {
        guard canSubmit else { return }
        isSubmitting = true
        uploadProgress = attachments.isEmpty ? 1 : 0
        errorMessage = nil

        do {
            var attachmentKeys: [String] = []
            if !attachments.isEmpty {
                let parts = attachments.enumerated().map { index, attachment in
                    MultipartFilePart(
                        fieldName: "files",
                        filename: "support-\(index + 1).jpg",
                        mimeType: "image/jpeg",
                        data: attachment.jpegData
                    )
                }
                let upload: APIEnvelope<UploadSupportAttachmentsResponse> = try await auth.api.uploadMultipart(
                    path: "uploads/support-attachments",
                    parts: parts
                ) { progress in
                    Task { @MainActor in
                        uploadProgress = progress
                    }
                }
                attachmentKeys = upload.data.files.map(\.key)
                guard attachmentKeys.count == attachments.count else {
                    throw APIError.transport("Photo upload incomplete.")
                }
                uploadProgress = 1
            }

            let response: APIEnvelope<SupportTicket> = try await auth.api.send(
                "POST",
                path: "support/tickets",
                body: CreateSupportTicketBody(
                    subject: trimmedSubject,
                    description: trimmedDescription,
                    category: category,
                    priority: priority,
                    attachmentKeys: attachmentKeys.isEmpty ? nil : attachmentKeys,
                    appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String,
                    platform: "iOS",
                    deviceName: UIDevice.current.name,
                    systemVersion: UIDevice.current.systemVersion
                )
            )
            onCreated(response.data)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }

        isSubmitting = false
        uploadProgress = 0
    }
}

struct SupportTicketDetailView: View {
    private static let maxAttachments = 9

    @Environment(AuthSession.self) private var auth
    @State private var detail: SupportTicketDetail?
    @State private var messages: [SupportMessage] = []
    @State private var draft = ""
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var attachments: [SupportDraftImage] = []
    @State private var isPreparingAttachments = false
    @State private var isLoading = true
    @State private var isSending = false
    @State private var isReopening = false
    @State private var uploadProgress: Double = 0
    @State private var errorMessage: String?
    @State private var feedbackTrigger = 0

    let ticket: SupportTicket
    var onUpdated: ((SupportTicket) -> Void)?

    private var currentTicket: SupportTicket {
        detail?.ticket ?? ticket
    }

    private var trimmedDraft: String {
        draft.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canSend: Bool {
        (!trimmedDraft.isEmpty || !attachments.isEmpty)
            && !isPreparingAttachments
            && !isSending
    }

    var body: some View {
        VStack(spacing: 0) {
            if isLoading && detail == nil {
                ProgressView("Loading conversation")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage, detail == nil {
                ContentUnavailableView {
                    Label("Couldn’t Load Ticket", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(errorMessage)
                } actions: {
                    Button("Retry") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ticketHeader

                            if messages.isEmpty {
                                ContentUnavailableView(
                                    "No Messages",
                                    systemImage: "bubble.left",
                                    description: Text("This conversation has no messages yet.")
                                )
                                .padding(.top, 40)
                            } else {
                                ForEach(messages) { message in
                                    messageBubble(message)
                                        .id(message.id)
                                        .transition(.move(edge: .bottom).combined(with: .opacity))
                                }
                            }
                        }
                        .padding(12)
                    }
                    .refreshable { await load() }
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

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .padding(.horizontal)
                        .padding(.vertical, 5)
                        .frame(maxWidth: .infinity)
                        .background(.bar)
                }

                if currentTicket.status.canReopen {
                    reopenBar
                } else {
                    messageComposer
                }
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(currentTicket.caseNumber)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .onChange(of: selectedPhotos) {
            Task { await prepareSelectedPhotos() }
        }
        .sensoryFeedback(.success, trigger: feedbackTrigger)
    }

    private var ticketHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(currentTicket.caseNumber)
                        .font(.caption.monospaced().weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(currentTicket.subject)
                        .font(.title3.bold())
                }
                Spacer(minLength: 8)
                SupportStatusBadge(status: currentTicket.status)
                    .animation(.snappy(duration: 0.25), value: currentTicket.status)
            }

            HStack(spacing: 12) {
                Label(currentTicket.category.displayName, systemImage: currentTicket.category.systemImage)
                Label(currentTicket.priority.displayName, systemImage: "flag.fill")
                    .foregroundStyle(currentTicket.priority.tint)
            }
            .font(.caption.weight(.semibold))

            Text("Opened \(currentTicket.createdAt.formatted(date: .abbreviated, time: .shortened))")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 14))
        .accessibilityElement(children: .combine)
    }

    private func messageBubble(_ message: SupportMessage) -> some View {
        let isMine = !message.isStaff

        return HStack(alignment: .bottom, spacing: 8) {
            if isMine {
                Spacer(minLength: 48)
            }

            VStack(alignment: isMine ? .trailing : .leading, spacing: 5) {
                Text(isMine ? "You" : "Support")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 4)

                VStack(alignment: .leading, spacing: 8) {
                    if !message.body.isEmpty {
                        Text(message.body)
                            .foregroundStyle(isMine ? Color.white : Color.primary)
                    }

                    ForEach(message.attachments) { attachment in
                        attachmentView(attachment, isMine: isMine)
                    }
                }
                .padding(.horizontal, 13)
                .padding(.vertical, 10)
                .background(
                    isMine ? Color.accentColor : Color(.secondarySystemFill),
                    in: .rect(cornerRadius: 18, style: .continuous)
                )

                Text(message.createdAt, style: .relative)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .padding(.horizontal, 4)
            }

            if !isMine {
                Spacer(minLength: 48)
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func attachmentView(_ attachment: SupportAttachment, isMine: Bool) -> some View {
        if attachment.mimeType.hasPrefix("image/") {
            Link(destination: attachment.url) {
                AsyncImage(url: attachment.url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                    case .failure:
                        Label("Couldn’t load photo", systemImage: "exclamationmark.triangle")
                            .font(.caption)
                    default:
                        ProgressView()
                            .tint(isMine ? .white : .accentColor)
                            .frame(width: 180, height: 120)
                    }
                }
                .frame(maxWidth: 240, maxHeight: 240)
                .clipShape(.rect(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open \(attachment.fileName)")
        } else {
            Link(destination: attachment.url) {
                Label(attachment.fileName, systemImage: "paperclip")
                    .font(.caption)
                    .foregroundStyle(isMine ? Color.white : Color.accentColor)
            }
        }
    }

    private var reopenBar: some View {
        VStack(spacing: 8) {
            Text("This ticket is \(currentTicket.status.displayName.lowercased()).")
                .font(.caption)
                .foregroundStyle(.secondary)
            Button {
                Task { await reopen() }
            } label: {
                if isReopening {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Label("Reopen Ticket", systemImage: "arrow.uturn.backward.circle.fill")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isReopening)
        }
        .padding(12)
        .background(.bar)
    }

    private var messageComposer: some View {
        VStack(spacing: 8) {
            if !attachments.isEmpty {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(attachments) { attachment in
                            composerThumbnail(attachment)
                        }
                    }
                    .padding(.horizontal, 2)
                }
                .scrollIndicators(.hidden)
            }

            if isSending && !attachments.isEmpty {
                ProgressView(value: uploadProgress)
                    .padding(.horizontal, 4)
            }

            HStack(alignment: .bottom, spacing: 9) {
                PhotosPicker(
                    selection: $selectedPhotos,
                    maxSelectionCount: Self.maxAttachments - attachments.count,
                    matching: .images
                ) {
                    if isPreparingAttachments {
                        ProgressView()
                            .frame(width: 34, height: 34)
                    } else {
                        Image(systemName: "photo")
                            .font(.title2)
                            .foregroundStyle(.secondary)
                            .frame(width: 34, height: 34)
                    }
                }
                .disabled(isPreparingAttachments || isSending || attachments.count >= Self.maxAttachments)
                .accessibilityLabel("Attach photos")

                TextField("Reply to support", text: $draft, axis: .vertical)
                    .lineLimit(1...8)
                    .padding(.horizontal, 13)
                    .padding(.vertical, 10)
                    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 20))

                Button {
                    Task { await send() }
                } label: {
                    if isSending {
                        ProgressView()
                            .frame(width: 34, height: 34)
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 33))
                            .symbolRenderingMode(.hierarchical)
                            .foregroundStyle(canSend ? Color.accentColor : Color.secondary)
                    }
                }
                .disabled(!canSend)
                .accessibilityLabel("Send reply")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(.bar)
    }

    private func composerThumbnail(_ attachment: SupportDraftImage) -> some View {
        ZStack(alignment: .topTrailing) {
            if let image = UIImage(data: attachment.jpegData) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 58, height: 58)
                    .clipShape(.rect(cornerRadius: 9))
            }
            Button {
                withAnimation(.snappy) {
                    attachments.removeAll { $0.id == attachment.id }
                }
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(.white, .black.opacity(0.65))
            }
            .buttonStyle(.plain)
            .offset(x: 4, y: -4)
            .disabled(isSending)
            .accessibilityLabel("Remove photo")
        }
        .frame(width: 62, height: 62)
    }

    private func load(silent: Bool = false) async {
        if !silent {
            isLoading = true
        }
        errorMessage = nil

        let _: APIEnvelope<SupportReadResult>? = try? await auth.api.send(
            "POST",
            path: "support/tickets/\(ticket.id)/read"
        )

        do {
            let response: APIEnvelope<SupportTicketDetail> = try await auth.api.send(
                path: "support/tickets/\(ticket.id)"
            )
            detail = response.data
            withAnimation(.snappy) {
                messages = response.data.messages
            }
            onUpdated?(response.data.ticket)
        } catch {
            errorMessage = error.localizedDescription
        }
        if !silent {
            isLoading = false
        }
    }

    private func prepareSelectedPhotos() async {
        let items = selectedPhotos
        guard !items.isEmpty else { return }
        isPreparingAttachments = true
        errorMessage = nil
        defer {
            selectedPhotos = []
            isPreparingAttachments = false
        }

        var prepared: [SupportDraftImage] = []
        for item in items {
            guard attachments.count + prepared.count < Self.maxAttachments else { break }
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data),
               let jpeg = ImageUploadPrep.jpegData(from: image, kind: .supportAttachment) {
                prepared.append(SupportDraftImage(jpegData: jpeg))
            }
        }
        guard !prepared.isEmpty else {
            errorMessage = "Couldn’t read the selected photos."
            return
        }
        withAnimation(.snappy) {
            attachments.append(contentsOf: prepared)
        }
    }

    private func send() async {
        guard canSend else { return }
        isSending = true
        uploadProgress = attachments.isEmpty ? 1 : 0
        errorMessage = nil

        do {
            var attachmentKeys: [String] = []
            if !attachments.isEmpty {
                let parts = attachments.enumerated().map { index, attachment in
                    MultipartFilePart(
                        fieldName: "files",
                        filename: "reply-\(index + 1).jpg",
                        mimeType: "image/jpeg",
                        data: attachment.jpegData
                    )
                }
                let upload: APIEnvelope<UploadSupportAttachmentsResponse> = try await auth.api.uploadMultipart(
                    path: "uploads/support-attachments",
                    parts: parts
                ) { progress in
                    Task { @MainActor in
                        uploadProgress = progress
                    }
                }
                attachmentKeys = upload.data.files.map(\.key)
                guard attachmentKeys.count == attachments.count else {
                    throw APIError.transport("Photo upload incomplete.")
                }
                uploadProgress = 1
            }

            let response: APIEnvelope<SupportMessage> = try await auth.api.send(
                "POST",
                path: "support/tickets/\(ticket.id)/messages",
                body: SendSupportMessageBody(
                    body: trimmedDraft.isEmpty ? nil : trimmedDraft,
                    attachmentKeys: attachmentKeys.isEmpty ? nil : attachmentKeys
                )
            )
            withAnimation(.snappy) {
                messages.append(response.data)
            }
            draft = ""
            attachments = []
            feedbackTrigger += 1
            await load(silent: true)
        } catch {
            errorMessage = error.localizedDescription
        }

        isSending = false
        uploadProgress = 0
    }

    private func reopen() async {
        isReopening = true
        errorMessage = nil
        do {
            let response: APIEnvelope<SupportTicketDetail> = try await auth.api.send(
                "POST",
                path: "support/tickets/\(ticket.id)/reopen"
            )
            withAnimation(.snappy) {
                detail = response.data
                messages = response.data.messages
            }
            onUpdated?(response.data.ticket)
            feedbackTrigger += 1
        } catch {
            errorMessage = error.localizedDescription
        }
        isReopening = false
    }
}

private struct SupportStatusBadge: View {
    let status: SupportTicketStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2.weight(.bold))
            .foregroundStyle(status.tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(status.tint.opacity(0.13), in: .capsule)
            .overlay {
                Capsule()
                    .strokeBorder(status.tint.opacity(0.18), lineWidth: 1)
            }
            .lineLimit(1)
            .accessibilityLabel("Status: \(status.displayName)")
    }
}

private struct SupportDraftImage: Identifiable {
    let id = UUID()
    let jpegData: Data
}

private struct SupportListQuery: Hashable {
    let caseNumber: String
    let status: SupportTicketStatus?

    var hasFilters: Bool {
        !caseNumber.isEmpty || status != nil
    }
}

private struct SupportReadResult: Decodable {
    let read: Bool
}

private extension SupportTicketStatus {
    var tint: Color {
        switch self {
        case .open: .green
        case .waitingForUser: .orange
        case .inProgress: .blue
        case .resolved: .teal
        case .closed: .gray
        }
    }
}

private extension SupportTicketPriority {
    var tint: Color {
        switch self {
        case .low: .gray
        case .normal: .blue
        case .high: .orange
        case .urgent: .red
        }
    }
}

private extension SupportTicketCategory {
    var systemImage: String {
        switch self {
        case .bug: "ladybug"
        case .featureRequest: "lightbulb"
        case .payment: "creditcard"
        case .account: "person.crop.circle"
        case .verification: "checkmark.seal"
        case .abuse: "shield.lefthalf.filled"
        case .other: "questionmark.circle"
        }
    }
}

#Preview("Support") {
    NavigationStack {
        SupportView()
    }
    .environment(AuthSession())
}
