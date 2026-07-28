import CoreLocation
import Foundation
import MapKit
import Observation
import SwiftUI
import UIKit

extension ServiceRequest {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var isMappable: Bool {
        CLLocationCoordinate2DIsValid(coordinate) && (latitude != 0 || longitude != 0)
    }

    var statusLabel: String {
        switch status {
        case .open: "Open"
        case .inProgress: "In Progress"
        case .completed: "Completed"
        case .cancelled: "Cancelled"
        }
    }

    var statusTint: Color {
        switch status {
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

private struct ExploreCategory: Identifiable {
    let id: String
    let name: String
    let symbol: String
}

struct ExploreView: View {
    @Environment(AuthSession.self) private var auth
    @State private var requests: [ServiceRequest] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var searchText = ""
    @State private var selectedCity: EstonianCity = .tallinn
    @State private var selectedCategoryID: String?
    @State private var sort: ExploreSort = .recommended
    @State private var layout: ExploreLayout = .list
    @State private var selectedRequestID: ServiceRequest.ID?
    @State private var camera: MapCameraPosition = .automatic
    @State private var nearby = NearbyLocation()
    @State private var isNewRequestPresented = false

    var body: some View {
        VStack(spacing: 0) {
            filterBar
            Divider()
                .opacity(0.4)
            switch layout {
            case .list: listLayout
            case .map: mapLayout
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Explore")
        .navigationDestination(for: ServiceRequest.self) { RequestDetailView(request: $0) }
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
                NewRequestView { created in
                    if created.city == selectedCity.displayName {
                        withAnimation {
                            requests.insert(created, at: 0)
                        }
                    }
                }
            }
        }
        .task(id: selectedCity) { await load() }
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
    }

    // MARK: - Filter bar

    private var filterBar: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                Menu {
                    Picker("City", selection: $selectedCity) {
                        ForEach(EstonianCity.allCases) { city in
                            Text(city.displayName).tag(city)
                        }
                    }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "mappin.and.ellipse")
                        Text(selectedCity.displayName)
                            .lineLimit(1)
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 11)
                    .background(Color(.secondarySystemBackground), in: .capsule)
                }
                .accessibilityLabel("City, \(selectedCity.displayName)")

                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Search requests or category", text: $searchText)
                        .autocorrectionDisabled()
                        .submitLabel(.search)
                    if !searchText.isEmpty {
                        Button {
                            searchText = ""
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Clear search")
                    }
                }
                .font(.subheadline)
                .padding(.horizontal, 14)
                .padding(.vertical, 11)
                .background(Color(.secondarySystemBackground), in: .capsule)

                Menu {
                    Picker("Sort by", selection: $sort) {
                        ForEach(ExploreSort.allCases) { option in
                            Label(option.rawValue, systemImage: option.symbol)
                                .tag(option)
                        }
                    }
                } label: {
                    Image(systemName: "line.3.horizontal.decrease")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(width: 42, height: 42)
                        .background(Color(.secondarySystemBackground), in: .circle)
                }
                .accessibilityLabel("Sort and filter")
            }
            .padding(.horizontal, 16)

            if !categories.isEmpty {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        chip(title: "All", symbol: "square.grid.2x2", isSelected: selectedCategoryID == nil) {
                            selectedCategoryID = nil
                        }
                        ForEach(categories) { category in
                            chip(
                                title: category.name,
                                symbol: category.symbol,
                                isSelected: selectedCategoryID == category.id
                            ) {
                                selectedCategoryID = selectedCategoryID == category.id ? nil : category.id
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                }
                .scrollIndicators(.hidden)
            }
        }
        .padding(.top, 4)
        .padding(.bottom, 12)
        .background(.bar)
    }

    private func chip(title: String, symbol: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            withAnimation(.snappy(duration: 0.22)) { action() }
        } label: {
            Label(title, systemImage: symbol)
                .font(.footnote.weight(.semibold))
                .labelStyle(.titleAndIcon)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(
                    isSelected ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(Color(.secondarySystemBackground)),
                    in: .capsule
                )
                .foregroundStyle(isSelected ? Color.white : Color.primary)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    // MARK: - List layout

    private var listColumns: [GridItem] {
        [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
    }

    private var listLayout: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                HStack {
                    Text(resultSummary)
                    Spacer()
                    Label(sort.rawValue, systemImage: sort.symbol)
                }
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)

                if isLoading && requests.isEmpty {
                    LazyVGrid(columns: listColumns, spacing: 10) {
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
                    .frame(maxWidth: .infinity, minHeight: 320)
                } else if visibleRequests.isEmpty {
                    ContentUnavailableView {
                        Label(
                            requests.isEmpty ? "No Open Requests" : "No Matches",
                            systemImage: requests.isEmpty ? "tray" : "magnifyingglass"
                        )
                    } description: {
                        Text(
                            requests.isEmpty
                                ? "No open requests in \(selectedCity.displayName) yet."
                                : "Try a different search or clear the filters."
                        )
                    } actions: {
                        if requests.isEmpty {
                            Button("New Request") {
                                isNewRequestPresented = true
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 320)
                } else {
                    LazyVGrid(columns: listColumns, spacing: 10) {
                        ForEach(visibleRequests) { request in
                            NavigationLink(value: request) {
                                RequestCard(request: request, distance: distanceText(to: request))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
        .scrollDismissesKeyboard(.immediately)
        .refreshable { await load() }
    }

    // MARK: - Map layout

    private var mapLayout: some View {
        Map(position: $camera, selection: $selectedRequestID) {
            ForEach(mappableRequests) { request in
                Annotation(request.title, coordinate: request.coordinate, anchor: .bottom) {
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
                Label(mapSummary, systemImage: "mappin.and.ellipse")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.regularMaterial, in: .capsule)
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
            .padding(16)
        }
        .overlay(alignment: .bottom) {
            if mappableRequests.isEmpty {
                Text(isLoading ? "Loading requests…" : "No mapped requests match your filters.")
                    .font(.footnote)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(.regularMaterial, in: .capsule)
                    .padding(.bottom, 18)
            } else {
                ScrollView(.horizontal) {
                    LazyHStack(spacing: 12) {
                        ForEach(mappableRequests) { request in
                            NavigationLink(value: request) {
                                MapRequestCard(request: request, distance: distanceText(to: request))
                            }
                            .buttonStyle(.plain)
                            .frame(width: 290)
                            .id(request.id)
                        }
                    }
                    .scrollTargetLayout()
                }
                .scrollTargetBehavior(.viewAligned)
                .scrollPosition(id: $selectedRequestID)
                .scrollIndicators(.hidden)
                .contentMargins(.horizontal, 16, for: .scrollContent)
                .padding(.bottom, 14)
            }
        }
        .onChange(of: selectedRequestID) {
            guard let request = mappableRequests.first(where: { $0.id == selectedRequestID }) else { return }
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

    private var categories: [ExploreCategory] {
        var seen = Set<String>()
        return requests
            .compactMap { request in
                seen.insert(request.categoryId).inserted
                    ? ExploreCategory(id: request.categoryId, name: request.categoryName, symbol: request.categorySymbol)
                    : nil
            }
            .sorted { $0.name < $1.name }
    }

    private var visibleRequests: [ServiceRequest] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let filtered = requests.filter { request in
            guard selectedCategoryID == nil || request.categoryId == selectedCategoryID else { return false }
            guard !query.isEmpty else { return true }
            return request.title.lowercased().contains(query)
                || request.city.lowercased().contains(query)
                || request.categoryName.lowercased().contains(query)
                || request.location.lowercased().contains(query)
                || request.description.lowercased().contains(query)
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

    private var resultSummary: String {
        let count = visibleRequests.count
        return count == 1 ? "1 open request" : "\(count) open requests"
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

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            let response: PaginatedEnvelope<[ServiceRequest], PageMeta> = try await auth.api.send(
                path: "requests",
                query: [
                    URLQueryItem(name: "city", value: selectedCity.rawValue),
                    URLQueryItem(name: "limit", value: "50")
                ],
                authenticated: false
            )
            withAnimation { requests = response.data }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Cards

struct RequestCard: View {
    let request: ServiceRequest
    var distance: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            thumbnail
            VStack(alignment: .leading, spacing: 5) {
                Text(request.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, minHeight: 36, alignment: .topLeading)

                Label(request.categoryName, systemImage: request.categorySymbol)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(request.accentTint)
                    .lineLimit(1)

                Label(distance.map { "\(request.city) · \($0)" } ?? request.city, systemImage: "mappin")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                HStack(spacing: 4) {
                    Text(request.budget ?? "Open")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(request.budget == nil ? .secondary : .primary)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    Label("\(request.offerCount)", systemImage: "tray.and.arrow.down")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 9)
            .padding(.top, 8)
            .padding(.bottom, 9)
        }
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(.rect(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(request.isPremium ? Color.orange.opacity(0.45) : Color.black.opacity(0.06))
        )
        .contentShape(.rect(cornerRadius: 14))
        .accessibilityElement(children: .combine)
    }

    private var thumbnail: some View {
        ZStack(alignment: .topTrailing) {
            Group {
                if let url = request.photos.first?.url {
                    AsyncImage(url: url) { image in
                        image
                            .resizable()
                            .scaledToFill()
                    } placeholder: {
                        request.accentTint.opacity(0.12)
                    }
                } else {
                    ZStack {
                        request.accentTint.opacity(0.12)
                        Image(systemName: request.categorySymbol)
                            .font(.title3)
                            .foregroundStyle(request.accentTint)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 96)
            .clipped()

            if request.isPremium {
                Image(systemName: "sparkles")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.orange)
                    .padding(5)
                    .background(.regularMaterial, in: .circle)
                    .padding(6)
                    .accessibilityLabel("Boosted")
            }
        }
        .accessibilityHidden(true)
    }
}

private struct MapRequestCard: View {
    let request: ServiceRequest
    var distance: String?

    var body: some View {
        HStack(spacing: 12) {
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
                        .foregroundStyle(request.accentTint)
                }
            }
            .frame(width: 62, height: 62)
            .clipShape(.rect(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 4) {
                Text(request.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text(distance.map { "\(request.city) · \($0)" } ?? request.city)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Text(request.budget ?? "Open budget")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(request.accentTint)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundStyle(.tertiary)
        }
        .padding(10)
        .background(.regularMaterial, in: .rect(cornerRadius: 18))
        .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
        .accessibilityElement(children: .combine)
    }
}

private struct RequestPin: View {
    let request: ServiceRequest
    let isSelected: Bool

    var body: some View {
        VStack(spacing: -3) {
            Image(systemName: request.categorySymbol)
                .font(.system(size: isSelected ? 16 : 13, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: isSelected ? 40 : 32, height: isSelected ? 40 : 32)
                .background(request.accentTint.gradient, in: .circle)
                .overlay(Circle().strokeBorder(.white, lineWidth: 2))
            Image(systemName: "arrowtriangle.down.fill")
                .font(.system(size: 10))
                .foregroundStyle(request.accentTint)
        }
        .shadow(color: .black.opacity(0.25), radius: 4, y: 2)
        .animation(.snappy(duration: 0.2), value: isSelected)
        .accessibilityLabel("\(request.title), \(request.categoryName)")
    }
}

private struct SkeletonRequestCard: View {
    @State private var isPulsing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            RoundedRectangle(cornerRadius: 0)
                .frame(maxWidth: .infinity)
                .frame(height: 96)
            VStack(alignment: .leading, spacing: 6) {
                RoundedRectangle(cornerRadius: 4)
                    .frame(height: 11)
                RoundedRectangle(cornerRadius: 4)
                    .frame(width: 72, height: 9)
                RoundedRectangle(cornerRadius: 4)
                    .frame(width: 56, height: 9)
            }
            .padding(9)
        }
        .foregroundStyle(.quaternary)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 14))
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
