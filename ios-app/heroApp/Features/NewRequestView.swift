import PhotosUI
import SwiftUI
import UIKit

struct NewRequestView: View {
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
    @State private var photoData: [Data] = []
    @State private var isLoadingCategories = true
    @State private var isSubmitting = false
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
        guard !isSubmitting, categoryId != nil else { return false }
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
                PhotosPicker(
                    selection: $selectedPhotos,
                    maxSelectionCount: 6,
                    matching: .images,
                    photoLibrary: .shared()
                ) {
                    Label(
                        photoData.isEmpty ? "Add photos" : "\(photoData.count) photo\(photoData.count == 1 ? "" : "s") selected",
                        systemImage: "photo.on.rectangle.angled"
                    )
                }
                .onChange(of: selectedPhotos) {
                    Task { await loadSelectedPhotos() }
                }

                if !photoData.isEmpty {
                    ScrollView(.horizontal) {
                        HStack(spacing: 8) {
                            ForEach(Array(photoData.enumerated()), id: \.offset) { index, data in
                                if let image = UIImage(data: data) {
                                    Image(uiImage: image)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 72, height: 72)
                                        .clipShape(.rect(cornerRadius: 10))
                                        .overlay(alignment: .topTrailing) {
                                            Button {
                                                photoData.remove(at: index)
                                                if selectedPhotos.indices.contains(index) {
                                                    selectedPhotos.remove(at: index)
                                                }
                                            } label: {
                                                Image(systemName: "xmark.circle.fill")
                                                    .symbolRenderingMode(.palette)
                                                    .foregroundStyle(.white, .black.opacity(0.55))
                                            }
                                            .offset(x: 4, y: -4)
                                        }
                                }
                            }
                        }
                    }
                }
            } header: {
                Text("Photos")
            } footer: {
                Text("Optional. Up to 6 JPEG/PNG/WebP images.")
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

    private func loadSelectedPhotos() async {
        var loaded: [Data] = []
        for item in selectedPhotos {
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data),
               let jpeg = image.jpegData(compressionQuality: 0.82) {
                loaded.append(jpeg)
            }
        }
        photoData = loaded
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
        errorMessage = nil

        do {
            var photoKeys: [String]?
            if !photoData.isEmpty {
                let parts = photoData.enumerated().map { index, data in
                    MultipartFilePart(
                        fieldName: "photos",
                        filename: "photo-\(index + 1).jpg",
                        mimeType: "image/jpeg",
                        data: data
                    )
                }
                let upload: APIEnvelope<UploadKeysResponse> = try await auth.api.uploadMultipart(
                    path: "uploads/request-photos",
                    parts: parts
                )
                photoKeys = upload.data.keys
            }

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
    }
}

#Preview("New Request") {
    NavigationStack {
        NewRequestView()
    }
    .environment(AuthSession())
}
