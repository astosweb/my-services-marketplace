import PhotosUI
import SwiftUI
import UIKit

struct NewRequestView: View {
    private static let maxPhotos = 9
    private static let photoColumns = Array(
        repeating: GridItem(.flexible(), spacing: 8),
        count: 3
    )

    @Environment(AuthSession.self) private var auth
    @Environment(\.dismiss) private var dismiss

    var onCreated: ((ServiceRequest) -> Void)?

    @State private var categories: [Category] = []
    @State private var categoryId: String?
    @State private var title = ""
    @State private var description = ""
    @State private var city: EstonianCity = .tallinn
    @State private var location = ""
    @State private var budgetEuros = ""
    @State private var pricingMode: RequestPricingMode = .providerOffers
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var draftPhotos: [DraftPhoto] = []
    @State private var isLoadingCategories = true
    @State private var isLoadingPhotos = false
    @State private var isSubmitting = false
    @State private var submitPhase: SubmitPhase = .idle
    @State private var uploadProgress: Double = 0
    @State private var errorMessage: String?
    @State private var nearby = NearbyLocation()

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
                Text("Title needs at least 3 characters, description at least 10.")
            }

            Section {
                LazyVGrid(columns: Self.photoColumns, spacing: 8) {
                    ForEach(draftPhotos) { photo in
                        photoCell(photo)
                    }

                    if draftPhotos.count < Self.maxPhotos {
                        PhotosPicker(
                            selection: $selectedPhotos,
                            maxSelectionCount: Self.maxPhotos - draftPhotos.count,
                            matching: .images,
                            photoLibrary: .shared()
                        ) {
                            addPhotoCell
                        }
                        .disabled(isSubmitting || isLoadingPhotos)
                        .onChange(of: selectedPhotos) {
                            Task { await appendSelectedPhotos() }
                        }
                    }
                }
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
                Text("Optional. Up to \(Self.maxPhotos) JPEG/PNG/WebP images in a 3×3 grid.")
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

            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("New Request")
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
                        Text("Post")
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
        }
    }

    private var addPhotoCell: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color(.secondarySystemFill))
            VStack(spacing: 6) {
                Image(systemName: "plus")
                    .font(.title2.weight(.semibold))
                Text(draftPhotos.isEmpty ? "Add" : "\(draftPhotos.count)/\(Self.maxPhotos)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .foregroundStyle(.secondary)
        }
        .aspectRatio(1, contentMode: .fit)
    }

    private func photoCell(_ photo: DraftPhoto) -> some View {
        ZStack(alignment: .topTrailing) {
            Group {
                if let image = UIImage(data: photo.data) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                    Color(.tertiarySystemFill)
                }
            }
            .frame(maxWidth: .infinity)
            .aspectRatio(1, contentMode: .fit)
            .clipShape(.rect(cornerRadius: 10))

            if isSubmitting, submitPhase == .uploadingPhotos {
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
               let jpeg = image.jpegData(compressionQuality: 0.82) {
                loaded.append(DraftPhoto(data: jpeg))
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
        submitPhase = draftPhotos.isEmpty ? .creatingRequest : .uploadingPhotos
        uploadProgress = 0
        errorMessage = nil

        do {
            var photoKeys: [String]?
            if !draftPhotos.isEmpty {
                let parts = draftPhotos.enumerated().map { index, photo in
                    MultipartFilePart(
                        fieldName: "photos",
                        filename: "photo-\(index + 1).jpg",
                        mimeType: "image/jpeg",
                        data: photo.data
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
                photoKeys = upload.data.keys
                uploadProgress = 1
            }

            submitPhase = .creatingRequest

            let center = city.center
            let coordinate: (latitude: Double, longitude: Double) = {
                if let location = nearby.location {
                    return (location.coordinate.latitude, location.coordinate.longitude)
                }
                return center
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
                pricingMode: pricingMode,
                photoKeys: photoKeys
            )

            let response: APIEnvelope<ServiceRequest> = try await auth.api.send(
                "POST",
                path: "requests",
                body: body
            )
            onCreated?(response.data)
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
    let id = UUID()
    let data: Data
}

private enum SubmitPhase: Equatable {
    case idle
    case uploadingPhotos
    case creatingRequest

    var label: String {
        switch self {
        case .idle: ""
        case .uploadingPhotos: "Uploading photos…"
        case .creatingRequest: "Publishing request…"
        }
    }
}

#Preview("New Request") {
    NavigationStack {
        NewRequestView()
    }
    .environment(AuthSession())
}
