import CoreLocation
import Foundation
import MapKit
import Observation
import SwiftUI

extension ServiceRequest {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var isMappable: Bool {
        CLLocationCoordinate2DIsValid(coordinate) && (latitude != 0 || longitude != 0)
    }

    var statusLabel: String {
        switch status {
        case .pendingReview: "Pending Review"
        case .open: "Open"
        case .inProgress: "In Progress"
        case .completed: "Completed"
        case .cancelled: "Cancelled / Rejected"
        }
    }

    var statusTint: Color {
        switch status {
        case .pendingReview: .orange
        case .open: .green
        case .inProgress: .blue
        case .completed: .gray
        case .cancelled: .red
        }
    }

    var accentTint: Color {
        isPremium ? .orange : .accentColor
    }
}

private enum ExploreLayout {
    case list
    case map

    var toggleSymbol: String {
        switch self {
        case .list: "map"
        case .map: "list.bullet"
        }
    }

    var toggleLabel: String {
        switch self {
        case .list: "Show map"
        case .map: "Show list"
        }
    }
}

private enum ExploreSort: String, CaseIterable, Identifiable {
    case recommended = "Recommended"
    case newest = "Newest"
    case budget = "Highest Budget"
    case nearest = "Nearest"

    var id: Self { self }

    var symbol: String {
        switch self {
        case .recommended: "sparkles"
        case .newest: "clock"
        case .budget: "eurosign.circle"
        case .nearest: "location"
        }
    }
}

struct ExploreView: View {
    @Environment(AuthSession.self) private var auth
    @State private var requests: [ServiceRequest] = []
    @State private var categories: [Category] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var selectedCity: EstonianCity = .tallinn
    @State private var selectedCategoryID: String?
    @State private var sort: ExploreSort = .recommended
    @State private var layout: ExploreLayout = .list
    @State private var selectedRequestID: ServiceRequest.ID?
    @State private var camera: MapCameraPosition = .automatic
    @State private var nearby = NearbyLocation()
    @State private var isNewRequestPresented = false

    var body: some View {
        Group {
            switch layout {
            case .list: listLayout
            case .map: mapLayout
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: ServiceRequest.self) { item in
            RequestDetailView(request: item) { updated in
                withAnimation {
                    if updated.status == .open || updated.status == .pendingReview {
                        if let index = requests.firstIndex(where: { $0.id == updated.id }) {
                            requests[index] = updated
                        }
                    } else {
                        requests.removeAll { $0.id == updated.id }
                    }
                }
            }
        }
        .notificationsToolbar()
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    withAnimation(.snappy) { layout = layout == .list ? .map : .list }
                } label: {
                    Image(systemName: layout.toggleSymbol)
                }
                .accessibilityLabel(layout.toggleLabel)
            }
            ToolbarItem(placement: .principal) {
                Menu {
                    Picker("City", selection: $selectedCity) {
                        ForEach(EstonianCity.allCases) { city in
                            Text(city.displayName).tag(city)
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.and.ellipse")
                        Text(selectedCity.displayName)
                            .lineLimit(1)
                        Image(systemName: "chevron.down")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.secondary)
                    }
                    .font(.headline)
                }
                .accessibilityLabel("City, \(selectedCity.displayName)")
            }
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
                    if created.city == selectedCity.displayName {
                        withAnimation {
                            requests.insert(created, at: 0)
                        }
                    }
                })
            }
        }
        .task {
            await loadCategories()
        }
        .task(id: selectedCity) {
            await load()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(10))
                guard !Task.isCancelled else { break }
                await load(silent: true)
            }
        }
        .onChange(of: selectedCity) {
            selectedCategoryID = nil
            selectedRequestID = nil
        }
        .onChange(of: layout) {
            if layout == .map { nearby.start() }
        }
        .onChange(of: sort) {
            if sort == .nearest { nearby.start() }
        }
        .sensoryFeedback(.selection, trigger: selectedRequestID)
        .sensoryFeedback(.selection, trigger: selectedCategoryID)
    }

    private var sortMenu: some View {
        Menu {
            Picker("Sort by", selection: $sort) {
                ForEach(ExploreSort.allCases) { option in
                    Label(option.rawValue, systemImage: option.symbol)
                        .tag(option)
                }
            }
        } label: {
            Label(sort.rawValue, systemImage: sort.symbol)
        }
        .accessibilityLabel("Sort by, \(sort.rawValue)")
    }

    private var categoryFilterMenu: some View {
        Menu {
            Button {
                withAnimation(.snappy(duration: 0.22)) { selectedCategoryID = nil }
            } label: {
                Label("All", systemImage: "square.grid.2x2")
            }
            ForEach(categories) { category in
                Button {
                    withAnimation(.snappy(duration: 0.22)) {
                        selectedCategoryID = selectedCategoryID == category.id ? nil : category.id
                    }
                } label: {
                    Label(category.name, systemImage: category.symbol)
                }
            }
        } label: {
            Label(selectedCategoryTitle, systemImage: selectedCategorySymbol)
        }
        .accessibilityLabel("Category, \(selectedCategoryTitle)")
    }

    private var selectedCategoryTitle: String {
        categories.first(where: { $0.id == selectedCategoryID })?.name ?? "All"
    }

    private var selectedCategorySymbol: String {
        categories.first(where: { $0.id == selectedCategoryID })?.symbol ?? "square.grid.2x2"
    }

    // MARK: - List layout

    private var listColumns: [GridItem] {
        [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]
    }

    private var listLayout: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                if !categories.isEmpty {
                    categoryBar
                }

                requestsSection
            }
            .padding(.horizontal, 10)
            .padding(.top, 4)
            .padding(.bottom, 12)
        }
        .refreshable { await load() }
    }

    private var categoryBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                CategoryChip(
                    title: "All",
                    symbol: "square.grid.2x2",
                    isSelected: selectedCategoryID == nil
                ) {
                    withAnimation(.snappy(duration: 0.22)) {
                        selectedCategoryID = nil
                    }
                }

                ForEach(categories) { category in
                    CategoryChip(
                        title: category.name,
                        symbol: category.symbol,
                        isSelected: selectedCategoryID == category.id
                    ) {
                        withAnimation(.snappy(duration: 0.22)) {
                            selectedCategoryID = selectedCategoryID == category.id ? nil : category.id
                        }
                    }
                }
            }
            .padding(.horizontal, 2)
            .padding(.vertical, 2)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Categories")
    }

    @ViewBuilder
    private var requestsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center) {
                Text(selectedCategoryID == nil ? "Requests" : selectedCategoryTitle)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                sortMenu
                    .font(.footnote.weight(.semibold))
            }
            .padding(.horizontal, 2)

            if isLoading && requests.isEmpty {
                LazyVGrid(columns: listColumns, spacing: 8) {
                    ForEach(0..<6, id: \.self) { _ in SkeletonRequestCard() }
                }
            } else if let errorMessage, requests.isEmpty {
                ContentUnavailableView {
                    Label("Couldn’t Load Requests", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(errorMessage)
                } actions: {
                    Button("Retry") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, minHeight: 220)
            } else if visibleRequests.isEmpty {
                let hasFilters = selectedCategoryID != nil
                ContentUnavailableView {
                    Label(
                        requests.isEmpty && !hasFilters ? "No Open Requests" : "No Category Matches",
                        systemImage: requests.isEmpty && !hasFilters ? "tray" : "folder"
                    )
                } description: {
                    Text(
                        requests.isEmpty && !hasFilters
                            ? "No open requests in \(selectedCity.displayName) yet."
                            : "No requests found for this category."
                    )
                } actions: {
                    if requests.isEmpty && !hasFilters {
                        Button("New Request") {
                            isNewRequestPresented = true
                        }
                        .buttonStyle(.borderedProminent)
                    } else if selectedCategoryID != nil {
                        Button("Clear Category") {
                            withAnimation(.snappy) { selectedCategoryID = nil }
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 220)
            } else {
                LazyVGrid(columns: listColumns, spacing: 8) {
                    ForEach(visibleRequests) { request in
                        NavigationLink(value: request) {
                            RequestCard(request: request, distance: distanceText(to: request))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // MARK: - Map layout

    private var selectedMapRequest: ServiceRequest? {
        mappableRequests.first(where: { $0.id == selectedRequestID })
    }

    private var mapLayout: some View {
        Map(position: $camera, selection: $selectedRequestID) {
            ForEach(mappableRequests) { request in
                Annotation(request.title, coordinate: request.coordinate, anchor: .center) {
                    RequestPin(request: request, isSelected: selectedRequestID == request.id)
                }
                .tag(request.id)
                .annotationTitles(.hidden)
            }
            UserAnnotation()
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .mapControls {
            MapUserLocationButton()
            MapCompass()
        }
        .overlay(alignment: .topLeading) {
            VStack(alignment: .leading, spacing: 8) {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        Label(mapSummary, systemImage: "mappin.and.ellipse")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(.regularMaterial, in: .capsule)
                            .lineLimit(1)
                        if !categories.isEmpty {
                            categoryFilterMenu
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(.regularMaterial, in: .capsule)
                                .lineLimit(1)
                        }
                        sortMenu
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(.regularMaterial, in: .capsule)
                            .lineLimit(1)
                    }
                }
                .scrollIndicators(.hidden)
                Button {
                    withAnimation(.easeInOut) {
                        selectedRequestID = nil
                        camera = fittedRegion.map { .region($0) } ?? .automatic
                    }
                } label: {
                    Image(systemName: "arrow.down.left.and.arrow.up.right")
                        .font(.caption.weight(.semibold))
                        .frame(width: 34, height: 34)
                        .background(.regularMaterial, in: .circle)
                }
                .accessibilityLabel("Show all requests")
                .opacity(mappableRequests.isEmpty ? 0 : 1)
            }
            .padding(12)
        }
        .overlay(alignment: .bottom) {
            Group {
                if mappableRequests.isEmpty {
                    Text(isLoading ? "Loading requests…" : "No mapped requests match your filters.")
                        .font(.footnote)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(.regularMaterial, in: .capsule)
                } else if let request = selectedMapRequest {
                    MapRequestDetailCard(
                        request: request,
                        distance: distanceText(to: request),
                        onDismiss: {
                            withAnimation(.snappy(duration: 0.22)) {
                                selectedRequestID = nil
                            }
                        }
                    )
                    .padding(.horizontal, 12)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .padding(.bottom, 18)
            .animation(.snappy(duration: 0.28), value: selectedRequestID)
        }
        .onChange(of: selectedRequestID) {
            guard let request = selectedMapRequest else { return }
            withAnimation(.easeInOut) {
                camera = .region(
                    MKCoordinateRegion(
                        center: request.coordinate,
                        latitudinalMeters: 1_600,
                        longitudinalMeters: 1_600
                    )
                )
            }
        }
    }

    // MARK: - Derived state

    private var visibleRequests: [ServiceRequest] {
        let filtered = requests.filter { request in
            guard request.status == .open || request.status == .pendingReview else { return false }
            guard selectedCategoryID == nil || request.categoryId == selectedCategoryID else { return false }
            return true
        }

        switch sort {
        case .recommended:
            return filtered.sorted { lhs, rhs in
                lhs.isPremium == rhs.isPremium ? lhs.createdAt > rhs.createdAt : lhs.isPremium
            }
        case .newest:
            return filtered.sorted { $0.createdAt > $1.createdAt }
        case .budget:
            return filtered.sorted { ($0.budgetCents ?? -1) > ($1.budgetCents ?? -1) }
        case .nearest:
            guard let origin = nearby.location else { return filtered }
            return filtered.sorted {
                CLLocation(latitude: $0.latitude, longitude: $0.longitude).distance(from: origin)
                    < CLLocation(latitude: $1.latitude, longitude: $1.longitude).distance(from: origin)
            }
        }
    }

    private var mappableRequests: [ServiceRequest] {
        visibleRequests.filter(\.isMappable)
    }

    private var mapSummary: String {
        let count = mappableRequests.count
        return count == 1 ? "1 request on map" : "\(count) requests on map"
    }

    private var fittedRegion: MKCoordinateRegion? {
        let coordinates = mappableRequests.map(\.coordinate)
        guard let first = coordinates.first else { return nil }
        var minLatitude = first.latitude
        var maxLatitude = first.latitude
        var minLongitude = first.longitude
        var maxLongitude = first.longitude
        for coordinate in coordinates.dropFirst() {
            minLatitude = min(minLatitude, coordinate.latitude)
            maxLatitude = max(maxLatitude, coordinate.latitude)
            minLongitude = min(minLongitude, coordinate.longitude)
            maxLongitude = max(maxLongitude, coordinate.longitude)
        }
        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: (minLatitude + maxLatitude) / 2,
                longitude: (minLongitude + maxLongitude) / 2
            ),
            span: MKCoordinateSpan(
                latitudeDelta: max((maxLatitude - minLatitude) * 1.6, 0.02),
                longitudeDelta: max((maxLongitude - minLongitude) * 1.6, 0.02)
            )
        )
    }

    private func distanceText(to request: ServiceRequest) -> String? {
        guard let origin = nearby.location, request.isMappable else { return nil }
        let meters = CLLocation(latitude: request.latitude, longitude: request.longitude).distance(from: origin)
        return Measurement(value: meters, unit: UnitLength.meters)
            .formatted(.measurement(width: .abbreviated, usage: .road))
    }

    private func loadCategories() async {
        guard categories.isEmpty else { return }
        do {
            let response: APIEnvelope<[Category]> = try await auth.api.send(
                path: "categories",
                authenticated: false
            )
            withAnimation {
                categories = response.data.sorted { $0.name < $1.name }
            }
        } catch {}
    }

    private func load(silent: Bool = false) async {
        if !silent {
            isLoading = true
            errorMessage = nil
        }
        do {
            let response: PaginatedEnvelope<[ServiceRequest], PageMeta> = try await auth.api.send(
                path: "requests",
                query: [
                    URLQueryItem(name: "city", value: selectedCity.rawValue),
                    URLQueryItem(name: "limit", value: "50")
                ],
                authenticated: false
            )
            withAnimation {
                requests = response.data.filter {
                    $0.status == .open || $0.status == .pendingReview
                }
            }
            errorMessage = nil
        } catch {
            if !silent || requests.isEmpty {
                errorMessage = error.localizedDescription
            }
        }
        if !silent {
            isLoading = false
        }
    }
}

// MARK: - Category Chip

private struct CategoryChip: View {
    let title: String
    let symbol: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: symbol)
                    .font(.caption.weight(.semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(isSelected ? Color.white : Color.accentColor)

                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(isSelected ? Color.white : Color.primary)
                    .lineLimit(1)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(chipBackground, in: .capsule)
            .overlay {
                if !isSelected {
                    Capsule()
                        .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
                }
            }
            .contentShape(.capsule)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityHint(isSelected ? "Double tap to clear filter" : "Double tap to filter by this category")
    }

    private var chipBackground: some ShapeStyle {
        if isSelected {
            AnyShapeStyle(Color.accentColor.gradient)
        } else {
            AnyShapeStyle(Color(.secondarySystemGroupedBackground))
        }
    }
}

// MARK: - Cards

struct RequestCard: View {
    let request: ServiceRequest
    var distance: String?

    @State private var galleryPage: Int? = 0
    @ScaledMetric(relativeTo: .caption) private var thumbnailHeight: CGFloat = 82

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            thumbnail
            VStack(alignment: .leading, spacing: 4) {
                Text(request.title)
                    .font(.footnote.weight(.semibold))
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text(request.description)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2, reservesSpace: true)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .topLeading)

                Spacer(minLength: 0)

                HStack(spacing: 4) {
                    Text(request.budget ?? "Open")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(request.budget == nil ? .secondary : .primary)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    Label("\(request.offerCount)", systemImage: "tray.and.arrow.down")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("\(request.offerCount) offers")
                    Label("\(request.viewCount)", systemImage: "eye")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("\(request.viewCount) visitors")
                }
            }
            .padding(.horizontal, 8)
            .padding(.top, 6)
            .padding(.bottom, 7)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(.rect(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(request.isPremium ? Color.orange.opacity(0.45) : Color.black.opacity(0.06))
        )
        .contentShape(.rect(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }

    private var thumbnail: some View {
        ZStack(alignment: .topLeading) {
            Group {
                if request.photos.isEmpty {
                    ZStack {
                        request.accentTint.opacity(0.12)
                        Image(systemName: request.categorySymbol)
                            .font(.subheadline)
                            .foregroundStyle(request.accentTint)
                    }
                } else {
                    ZStack(alignment: .bottom) {
                        ScrollView(.horizontal) {
                            LazyHStack(spacing: 0) {
                                ForEach(Array(request.photos.enumerated()), id: \.element.id) { index, photo in
                                    AsyncImage(url: photo.url) { image in
                                        image
                                            .resizable()
                                            .scaledToFill()
                                    } placeholder: {
                                        request.accentTint.opacity(0.12)
                                    }
                                    .containerRelativeFrame(.horizontal)
                                    .frame(height: thumbnailHeight)
                                    .clipped()
                                    .id(index)
                                }
                            }
                            .scrollTargetLayout()
                        }
                        .scrollTargetBehavior(.paging)
                        .scrollPosition(id: $galleryPage)
                        .scrollIndicators(.hidden)

                        if request.photos.count > 1 {
                            HStack(spacing: 4) {
                                ForEach(0..<request.photos.count, id: \.self) { index in
                                    Capsule()
                                        .fill(index == (galleryPage ?? 0) ? Color.white : Color.white.opacity(0.4))
                                        .frame(width: index == (galleryPage ?? 0) ? 10 : 4, height: 4)
                                        .animation(.snappy(duration: 0.2), value: galleryPage)
                                }
                            }
                            .padding(.bottom, 5)
                            .allowsHitTesting(false)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: thumbnailHeight)
            .clipped()
            .accessibilityHidden(true)
            .overlay(alignment: .bottomLeading) {
                if request.status != .open {
                    Text(request.statusLabel)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(request.statusTint)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(.regularMaterial, in: .capsule)
                        .padding(5)
                }
            }

            if request.isPremium {
                Image(systemName: "sparkles")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.orange)
                    .padding(4)
                    .background(.regularMaterial, in: .circle)
                    .padding(5)
                    .accessibilityLabel("Boosted")
            }

            Label(request.categoryName, systemImage: request.categorySymbol)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(request.accentTint)
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(.regularMaterial, in: .capsule)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(5)
        }
    }
}

private struct MapRequestDetailCard: View {
    let request: ServiceRequest
    var distance: String?
    var onDismiss: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            NavigationLink(value: request) {
                HStack(alignment: .top, spacing: 12) {
                    ZStack {
                        if let url = request.photos.first?.url {
                            AsyncImage(url: url) { image in
                                image
                                    .resizable()
                                    .scaledToFill()
                            } placeholder: {
                                request.accentTint.opacity(0.12)
                            }
                        } else {
                            request.accentTint.opacity(0.12)
                            Image(systemName: request.categorySymbol)
                                .font(.title3)
                                .foregroundStyle(request.accentTint)
                        }
                    }
                    .frame(width: 72, height: 72)
                    .clipShape(.circle)
                    .overlay(Circle().strokeBorder(.white.opacity(0.9), lineWidth: 2))

                    VStack(alignment: .leading, spacing: 4) {
                        Text(request.title)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        Label(request.categoryName, systemImage: request.categorySymbol)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(request.accentTint)
                            .lineLimit(1)

                        Text(distance.map { "\(request.city) · \($0)" } ?? request.city)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)

                        HStack(spacing: 8) {
                            Text(request.budget ?? "Open budget")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(request.accentTint)
                            Spacer(minLength: 0)
                            Text("View details")
                                .font(.caption.weight(.semibold))
                            Image(systemName: "chevron.right")
                                .font(.caption2.weight(.bold))
                        }
                        .foregroundStyle(.secondary)
                    }
                }
            }
            .buttonStyle(.plain)

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                    .frame(width: 28, height: 28)
                    .background(Color.primary.opacity(0.06), in: .circle)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss")
        }
        .padding(12)
        .background(.regularMaterial, in: .rect(cornerRadius: 20))
        .shadow(color: .black.opacity(0.14), radius: 12, y: 4)
        .accessibilityElement(children: .contain)
    }
}

private struct RequestPin: View {
    let request: ServiceRequest
    let isSelected: Bool

    private var size: CGFloat { isSelected ? 52 : 40 }

    var body: some View {
        ZStack {
            Circle()
                .fill(request.accentTint.gradient)
                .frame(width: size, height: size)
                .overlay {
                    if let url = request.photos.first?.url {
                        AsyncImage(url: url) { image in
                            image
                                .resizable()
                                .scaledToFill()
                        } placeholder: {
                            Image(systemName: request.categorySymbol)
                                .font(.system(size: isSelected ? 18 : 14, weight: .semibold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: size, height: size)
                        .clipShape(.circle)
                    } else {
                        Image(systemName: request.categorySymbol)
                            .font(.system(size: isSelected ? 18 : 14, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                }
                .overlay(
                    Circle()
                        .strokeBorder(.white, lineWidth: isSelected ? 3 : 2)
                )
                .shadow(color: .black.opacity(isSelected ? 0.3 : 0.2), radius: isSelected ? 8 : 4, y: 2)

            if request.isPremium {
                Image(systemName: "sparkles")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.orange)
                    .padding(3)
                    .background(.regularMaterial, in: .circle)
                    .offset(x: size * 0.32, y: -size * 0.32)
            }
        }
        .frame(width: size + 8, height: size + 8)
        .scaleEffect(isSelected ? 1.08 : 1)
        .animation(.snappy(duration: 0.2), value: isSelected)
        .accessibilityLabel("\(request.title), \(request.categoryName)")
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}

private struct SkeletonRequestCard: View {
    @State private var isPulsing = false
    @ScaledMetric(relativeTo: .caption) private var thumbnailHeight: CGFloat = 82

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            RoundedRectangle(cornerRadius: 0)
                .frame(maxWidth: .infinity)
                .frame(height: thumbnailHeight)
            VStack(alignment: .leading, spacing: 5) {
                RoundedRectangle(cornerRadius: 4)
                    .frame(height: 10)
                RoundedRectangle(cornerRadius: 4)
                    .frame(height: 8)
                RoundedRectangle(cornerRadius: 4)
                    .frame(width: 100, height: 8)
                Spacer(minLength: 0)
                RoundedRectangle(cornerRadius: 4)
                    .frame(width: 48, height: 8)
            }
            .padding(8)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .foregroundStyle(.quaternary)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 12))
        .opacity(isPulsing ? 0.55 : 1)
        .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: isPulsing)
        .onAppear { isPulsing = true }
        .accessibilityHidden(true)
    }
}

@Observable
final class NearbyLocation {
    private(set) var location: CLLocation?
    @ObservationIgnored private let manager = CLLocationManager()
    @ObservationIgnored private var updates: Task<Void, Never>?

    func start() {
        guard updates == nil else { return }
        if manager.authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
        }
        updates = Task { [weak self] in
            do {
                for try await update in CLLocationUpdate.liveUpdates(.default) {
                    if let location = update.location {
                        self?.location = location
                        break
                    }
                    if update.authorizationDenied || update.authorizationRestricted {
                        break
                    }
                }
            } catch {}
            self?.updates = nil
        }
    }
}

#Preview("Explore") {
    NavigationStack {
        ExploreView()
    }
    .environment(AuthSession())
}
