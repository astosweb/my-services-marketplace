import PhotosUI
import SwiftUI
import UIKit

struct NewRequestView: View {
    private static let maxPhotos = 6
    private static let photoSpacing: CGFloat = 8
    private static let photoColumns = Array(
        repeating: GridItem(.flexible(), spacing: photoSpacing),
        count: 3
    )

    @Environment(AuthSession.self) private var auth
    @Environment(\.dismiss) private var dismiss

    /// When set, the form updates this request instead of creating a new one.
    var existing: ServiceRequest?
    var onCreated: ((ServiceRequest) -> Void)?
    var onUpdated: ((ServiceRequest) -> Void)?

    @State private var categories: [Category] = []
    @State private var categoryId: String?
    @State private var title = ""
    @State private var description = ""
    @State private var city: EstonianCity = .tallinn
    @State private var location = ""
    @State private var budgetEuros = ""
    @State private var pricingMode: RequestPricingMode = .providerOffers
    @State private var hasSchedule = false
    @State private var scheduledAt = Calendar.current.date(
        byAdding: .day,
        value: 1,
        to: Date()
    ) ?? Date().addingTimeInterval(86_400)
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var draftPhotos: [DraftPhoto] = []
    @State private var isLoadingCategories = true
    @State private var isLoadingPhotos = false
    @State private var isSubmitting = false
    @State private var submitPhase: SubmitPhase = .idle
    @State private var uploadProgress: Double = 0
    @State private var errorMessage: String?
    @State private var nearby = NearbyLocation()
    @State private var didPrefill = false

    private var isEditing: Bool { existing != nil }

    private var trimmedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var trimmedDescription: String {
        description.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var trimmedLocation: String {
        location.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var budgetCents: Int? {
        let cleaned = budgetEuros
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        guard !cleaned.isEmpty, let euros = Double(cleaned), euros > 0 else { return nil }
        return Int((euros * 100).rounded())
    }

    private var canSubmit: Bool {
        guard !isSubmitting, !isLoadingPhotos, categoryId != nil else { return false }
        guard trimmedTitle.count >= 3, trimmedDescription.count >= 10 else { return false }
        guard !trimmedLocation.isEmpty else { return false }
        if pricingMode == .ownerFixedPrice {
            return budgetCents != nil
        }
        return true
    }

    var body: some View {
        Form {
            Section {
                Picker("Category", selection: $categoryId) {
                    Text("Select a category").tag(Optional<String>.none)
                    ForEach(categories) { category in
                        Label(category.name, systemImage: category.symbol)
                            .tag(Optional(category.id))
                    }
                }
                .disabled(isLoadingCategories)

                TextField("Title", text: $title, prompt: Text("e.g. Fix leaking kitchen sink"))
                    .textInputAutocapitalization(.sentences)

                TextField(
                    "Description",
                    text: $description,
                    prompt: Text("What needs doing, timing, access notes…"),
                    axis: .vertical
                )
                .lineLimit(4...10)
                .textInputAutocapitalization(.sentences)
            } header: {
                Text("Job")
            } footer: {
                Text(
                    isEditing
                        ? "Edits are only allowed while the request is open and has no offers."
                        : "Title needs at least 3 characters, description at least 10."
                )
            }

            Section {
                photoGrid
                    .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))

                if isLoadingPhotos {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text("Loading photos…")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                if isSubmitting {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(submitPhase.label)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        if submitPhase == .uploadingPhotos {
                            ProgressView(value: uploadProgress)
                                .tint(.accentColor)
                            Text("\(Int((uploadProgress * 100).rounded()))%")
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(.tertiary)
                        } else {
                            ProgressView()
                        }
                    }
                }
            } header: {
                Text("Photos")
            } footer: {
                Text("Optional. Up to \(Self.maxPhotos) JPEG/PNG/WebP images in a 3×2 grid.")
            }

            Section("Where") {
                Picker("City", selection: $city) {
                    ForEach(EstonianCity.allCases) { option in
                        Text(option.displayName).tag(option)
                    }
                }

                TextField("Location", text: $location, prompt: Text("Neighborhood, address, or landmark"))
                    .textInputAutocapitalization(.words)
            }

            Section {
                Picker("Pricing", selection: $pricingMode) {
                    ForEach(RequestPricingMode.allCases) { mode in
                        Text(mode.label).tag(mode)
                    }
                }

                TextField(
                    pricingMode == .ownerFixedPrice ? "Fixed price (€)" : "Budget (€, optional)",
                    text: $budgetEuros
                )
                .keyboardType(.decimalPad)
            } header: {
                Text("Budget")
            } footer: {
                Text(
                    pricingMode == .ownerFixedPrice
                        ? "Providers can only show interest at your fixed price."
                        : "Leave blank for an open budget. Providers will send offers."
                )
            }

            Section {
                Toggle("Schedule a time", isOn: $hasSchedule)
                if hasSchedule {
                    DatePicker(
                        "When",
                        selection: $scheduledAt,
                        in: Date()...,
                        displayedComponents: [.date, .hourAndMinute]
                    )
                }
            } header: {
                Text("Schedule")
            } footer: {
                Text("Optional. When you need the job done.")
            }

            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle(isEditing ? "Edit Request" : "New Request")
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
                        Text(isEditing ? "Save" : "Post")
                            .fontWeight(.semibold)
                    }
                }
                .disabled(!canSubmit)
            }
        }
        .interactiveDismissDisabled(isSubmitting)
        .task {
            nearby.start()
            await loadCategories()
            prefillIfNeeded()
        }
    }

    private var photoGrid: some View {
        Color.clear
            .aspectRatio(3 / 2, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .overlay {
                GeometryReader { geo in
                    let side = (geo.size.width - Self.photoSpacing * 2) / 3
                    LazyVGrid(columns: Self.photoColumns, spacing: Self.photoSpacing) {
                        ForEach(0..<Self.maxPhotos, id: \.self) { index in
                            Group {
                                if index < draftPhotos.count {
                                    photoCell(draftPhotos[index])
                                } else if index == draftPhotos.count {
                                    PhotosPicker(
                                        selection: $selectedPhotos,
                                        maxSelectionCount: Self.maxPhotos - draftPhotos.count,
                                        matching: .images,
                                        photoLibrary: .shared()
                                    ) {
                                        emptyPhotoCell
                                    }
                                    .disabled(isSubmitting || isLoadingPhotos)
                                } else {
                                    emptyPhotoCell
                                }
                            }
                            .frame(width: side, height: side)
                            .clipped()
                        }
                    }
                }
            }
            .onChange(of: selectedPhotos) {
                Task { await appendSelectedPhotos() }
            }
    }

    private var emptyPhotoCell: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color(.secondarySystemFill))
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(
                    Color(.tertiaryLabel).opacity(0.35),
                    style: StrokeStyle(lineWidth: 1, dash: [5, 4])
                )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func photoCell(_ photo: DraftPhoto) -> some View {
        ZStack(alignment: .topTrailing) {
            Group {
                if let data = photo.jpegData, let image = UIImage(data: data) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else if let url = photo.remoteURL {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFill()
                        default:
                            Color(.tertiarySystemFill)
                        }
                    }
                } else {
                    Color(.tertiarySystemFill)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()
            .clipShape(.rect(cornerRadius: 10))

            if isSubmitting, submitPhase == .uploadingPhotos, photo.jpegData != nil {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(.black.opacity(0.35))
                ProgressView()
                    .tint(.white)
            }

            Button {
                draftPhotos.removeAll { $0.id == photo.id }
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(.white, .black.opacity(0.55))
                    .font(.title3)
            }
            .buttonStyle(.plain)
            .offset(x: 4, y: -4)
            .disabled(isSubmitting)
            .opacity(isSubmitting ? 0 : 1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func prefillIfNeeded() {
        guard !didPrefill, let existing else { return }
        didPrefill = true
        categoryId = existing.categoryId
        title = existing.title
        description = existing.description
        city = EstonianCity.fromAPICity(existing.city)
        location = existing.location
        pricingMode = existing.pricingMode
        if let cents = existing.budgetCents {
            budgetEuros = String(format: "%.0f", Double(cents) / 100)
        }
        if let existingScheduledAt = existing.scheduledAt {
            hasSchedule = true
            scheduledAt = max(existingScheduledAt, Date())
        }
        draftPhotos = Array(
            existing.photos
                .sorted { $0.sortOrder < $1.sortOrder }
                .prefix(Self.maxPhotos)
                .map { photo in
                    DraftPhoto(
                        id: photo.id,
                        jpegData: nil,
                        existingKey: photo.key ?? Self.uploadKey(from: photo.url),
                        remoteURL: photo.url
                    )
                }
        )
    }

    /// Pull Spaces key from `/uploads/…` or CDN URL path.
    private static func uploadKey(from url: URL) -> String? {
        let path = url.path
        if path.hasPrefix("/uploads/") {
            return String(path.dropFirst("/uploads/".count))
        }
        if path.hasPrefix("/requests/") || path.hasPrefix("/avatars/") {
            return String(path.dropFirst(1))
        }
        return nil
    }

    private func appendSelectedPhotos() async {
        let items = selectedPhotos
        guard !items.isEmpty else { return }
        isLoadingPhotos = true
        defer {
            isLoadingPhotos = false
            selectedPhotos = []
        }

        var loaded: [DraftPhoto] = []
        for item in items {
            guard draftPhotos.count + loaded.count < Self.maxPhotos else { break }
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data),
               let jpeg = ImageUploadPrep.jpegData(from: image, kind: .requestPhoto) {
                loaded.append(DraftPhoto(jpegData: jpeg))
            }
        }
        draftPhotos.append(contentsOf: loaded)
    }

    private func loadCategories() async {
        isLoadingCategories = true
        do {
            let response: APIEnvelope<[Category]> = try await auth.api.send(
                path: "categories",
                authenticated: false
            )
            categories = response.data
            if categoryId == nil {
                categoryId = categories.first?.id
            }
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoadingCategories = false
    }

    private func submit() async {
        guard canSubmit, let categoryId else { return }
        isSubmitting = true
        let needsUpload = draftPhotos.contains { $0.jpegData != nil }
        submitPhase = needsUpload ? .uploadingPhotos : (isEditing ? .savingRequest : .creatingRequest)
        uploadProgress = 0
        errorMessage = nil

        do {
            var uploadedKeys: [String] = []
            let newParts = draftPhotos.compactMap { photo -> (DraftPhoto, Data)? in
                guard let data = photo.jpegData else { return nil }
                return (photo, data)
            }
            if !newParts.isEmpty {
                let parts = newParts.enumerated().map { index, item in
                    MultipartFilePart(
                        fieldName: "photos",
                        filename: "photo-\(index + 1).jpg",
                        mimeType: "image/jpeg",
                        data: item.1
                    )
                }
                let upload: APIEnvelope<UploadKeysResponse> = try await auth.api.uploadMultipart(
                    path: "uploads/request-photos",
                    parts: parts
                ) { progress in
                    Task { @MainActor in
                        uploadProgress = progress
                    }
                }
                uploadedKeys = upload.data.keys
                uploadProgress = 1
            }

            submitPhase = isEditing ? .savingRequest : .creatingRequest

            var photoKeys: [String] = []
            var uploadIndex = 0
            for photo in draftPhotos {
                if photo.jpegData != nil {
                    guard uploadIndex < uploadedKeys.count else {
                        throw APIError.transport("Photo upload incomplete.")
                    }
                    photoKeys.append(uploadedKeys[uploadIndex])
                    uploadIndex += 1
                } else if let key = photo.existingKey {
                    photoKeys.append(key)
                }
            }

            let coordinate: (latitude: Double, longitude: Double) = {
                if isEditing, let existing {
                    return (existing.latitude, existing.longitude)
                }
                if let location = nearby.location {
                    return (location.coordinate.latitude, location.coordinate.longitude)
                }
                return city.center
            }()

            let cents = budgetCents
            let body = CreateRequestBody(
                categoryId: categoryId,
                title: trimmedTitle,
                description: trimmedDescription,
                city: city.rawValue,
                latitude: coordinate.latitude,
                longitude: coordinate.longitude,
                location: trimmedLocation,
                budgetCents: cents,
                budgetLabel: cents.map { String(format: "€%.0f", Double($0) / 100) },
                scheduledAt: hasSchedule ? scheduledAt : nil,
                pricingMode: pricingMode,
                photoKeys: photoKeys
            )

            if let existing {
                let response: APIEnvelope<ServiceRequest> = try await auth.api.send(
                    "PATCH",
                    path: "requests/\(existing.id)",
                    body: body
                )
                onUpdated?(response.data)
            } else {
                let response: APIEnvelope<ServiceRequest> = try await auth.api.send(
                    "POST",
                    path: "requests",
                    body: body
                )
                onCreated?(response.data)
            }
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSubmitting = false
        submitPhase = .idle
        uploadProgress = 0
    }
}

private struct DraftPhoto: Identifiable {
    let id: String
    var jpegData: Data?
    var existingKey: String?
    var remoteURL: URL?

    init(
        id: String = UUID().uuidString,
        jpegData: Data? = nil,
        existingKey: String? = nil,
        remoteURL: URL? = nil
    ) {
        self.id = id
        self.jpegData = jpegData
        self.existingKey = existingKey
        self.remoteURL = remoteURL
    }
}

private enum SubmitPhase: Equatable {
    case idle
    case uploadingPhotos
    case creatingRequest
    case savingRequest

    var label: String {
        switch self {
        case .idle: ""
        case .uploadingPhotos: "Uploading photos…"
        case .creatingRequest: "Publishing request…"
        case .savingRequest: "Saving changes…"
        }
    }
}

#Preview("New Request") {
    NavigationStack {
        NewRequestView()
    }
    .environment(AuthSession())
}
