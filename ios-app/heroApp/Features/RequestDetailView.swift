import CoreLocation
import Foundation
import MapKit
import SwiftUI
import UIKit

struct RequestDetailView: View {
    @Environment(\.openURL) private var openURL
    @Environment(AuthSession.self) private var auth

    @State private var request: ServiceRequest
    @State private var ownerOffers: [Offer] = []
    @State private var isLoadingOffers = false
    @State private var offerPriceEuros = ""
    @State private var offerMessage = ""
    @State private var isSubmittingOffer = false
    @State private var respondingOfferId: String?
    @State private var isUpdatingStatus = false
    @State private var isUpdatingProgress = false
    @State private var reviewRating = 5
    @State private var reviewBody = ""
    @State private var isSubmittingReview = false
    @State private var hasSubmittedReview = false
    @State private var conversationId: String?
    @State private var isOpeningChat = false
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var didRecordView = false
    @State private var pendingCancel = false
    @State private var pendingAcceptOffer: Offer?
    @State private var pendingWithdrawOffer: Offer?
    @State private var isEditPresented = false

    init(request: ServiceRequest) {
        _request = State(initialValue: request)
    }

    private var isOwner: Bool {
        auth.user?.id == request.requester.id
    }

    private var isAcceptedProvider: Bool {
        request.acceptedOffer?.provider.id == auth.user?.id
    }

    private var canOwnerEdit: Bool {
        isOwner && request.status == .open && request.offerCount == 0
    }

    private var canSendOffer: Bool {
        guard auth.user != nil, !isOwner, request.status == .open else { return false }
        if let existing = request.viewerOffer {
            return existing.status == .declined || existing.status == .withdrawn
        }
        return true
    }

    private var isFixedPriceInterest: Bool {
        request.pricingMode == .ownerFixedPrice
    }

    private var offerPriceCents: Int? {
        let cleaned = offerPriceEuros
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        guard !cleaned.isEmpty, let euros = Double(cleaned), euros > 0 else { return nil }
        return Int((euros * 100).rounded())
    }

    private var canSubmitOffer: Bool {
        guard !isSubmittingOffer else { return false }
        if isFixedPriceInterest { return true }
        return offerPriceCents != nil
    }

    private var nextProviderProgress: JobProgressStatus? {
        guard isAcceptedProvider, request.status == .inProgress else { return nil }
        switch request.progressStatus {
        case .accepted, .none: return .onTheWay
        case .onTheWay: return .started
        case .started: return .providerDone
        case .providerDone, .ownerConfirmed: return nil
        }
    }

    private var canOwnerComplete: Bool {
        isOwner && request.status == .inProgress && request.progressStatus == .providerDone
    }

    private var canOwnerCancel: Bool {
        isOwner && (request.status == .open || request.status == .inProgress)
    }

    private var canLeaveReview: Bool {
        guard request.status == .completed, !hasSubmittedReview else { return false }
        return isOwner || isAcceptedProvider
    }

    private var canOpenConversation: Bool {
        auth.user != nil && (isOwner || isAcceptedProvider) && request.status != .open
    }

    private var canMessageOwner: Bool {
        auth.user != nil && !isOwner && !canOpenConversation
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if !request.photos.isEmpty {
                    gallery
                }
                overviewCard
                if let successMessage {
                    Label(successMessage, systemImage: "checkmark.circle.fill")
                        .font(.footnote)
                        .foregroundStyle(.green)
                }
                if !request.description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    descriptionCard
                }
                requesterCard
                if canMessageOwner {
                    messageOwnerCard
                }
                if request.isMappable {
                    locationCard
                }
                if let accepted = request.acceptedOffer {
                    acceptedOfferCard(accepted)
                }
                if canOpenConversation || nextProviderProgress != nil || canOwnerComplete || canOwnerCancel {
                    jobActionsCard
                }
                if canLeaveReview {
                    reviewCard
                }
                if isOwner {
                    ownerOffersSection
                } else if let viewerOffer = request.viewerOffer {
                    viewerOfferCard(viewerOffer)
                }
                if canSendOffer {
                    sendOfferCard
                }
                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(request.categoryName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if canOwnerEdit {
                ToolbarItem(placement: .primaryAction) {
                    Button("Edit") { isEditPresented = true }
                }
            }
        }
        .sheet(isPresented: $isEditPresented) {
            NavigationStack {
                NewRequestView(existing: request, onUpdated: { updated in
                    request = updated
                    successMessage = "Request updated."
                    errorMessage = nil
                })
            }
        }
        .navigationDestination(item: $conversationId) { id in
            ConversationDetailView(
                conversation: Conversation(
                    id: id,
                    requestId: request.id,
                    requestTitle: request.title,
                    categoryId: request.categoryId,
                    categoryName: request.categoryName,
                    categorySymbol: request.categorySymbol,
                    participant: conversationPeer,
                    lastMessage: nil,
                    updatedAt: Date(),
                    unreadCount: 0,
                    isPinned: false,
                    isArchived: false
                )
            )
        }
        .task(id: request.id) {
            await refreshDetail()
            await recordViewIfNeeded()
            if isOwner {
                await loadOwnerOffers()
            }
        }
        .onChange(of: auth.user?.id) {
            Task {
                await refreshDetail()
                if isOwner {
                    await loadOwnerOffers()
                } else {
                    ownerOffers = []
                }
            }
        }
        .confirmationDialog("Cancel this request?", isPresented: $pendingCancel, titleVisibility: .visible) {
            Button("Cancel request", role: .destructive) {
                Task { await updateRequestStatus(.cancelled) }
            }
            Button("Keep request", role: .cancel) {}
        } message: {
            Text("Pending offers will be declined. This cannot be undone.")
        }
        .confirmationDialog(
            "Accept this offer?",
            isPresented: Binding(
                get: { pendingAcceptOffer != nil },
                set: { if !$0 { pendingAcceptOffer = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Accept offer") {
                if let offer = pendingAcceptOffer {
                    Task { await respond(to: offer, status: .accepted) }
                }
                pendingAcceptOffer = nil
            }
            Button("Not now", role: .cancel) {
                pendingAcceptOffer = nil
            }
        } message: {
            Text("Other pending offers will be declined.")
        }
        .confirmationDialog(
            "Withdraw your offer?",
            isPresented: Binding(
                get: { pendingWithdrawOffer != nil },
                set: { if !$0 { pendingWithdrawOffer = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Withdraw", role: .destructive) {
                if let offer = pendingWithdrawOffer {
                    Task { await respond(to: offer, status: .withdrawn) }
                }
                pendingWithdrawOffer = nil
            }
            Button("Keep offer", role: .cancel) {
                pendingWithdrawOffer = nil
            }
        }
    }

    private var conversationPeer: OfferUser {
        if isOwner, let accepted = request.acceptedOffer {
            return accepted.provider
        }
        return request.requester
    }

    // MARK: - Gallery

    private var gallery: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(request.photos) { photo in
                    AsyncImage(url: photo.url) { image in
                        image
                            .resizable()
                            .scaledToFill()
                    } placeholder: {
                        ZStack {
                            Color(.tertiarySystemFill)
                            ProgressView()
                        }
                    }
                    .containerRelativeFrame(.horizontal)
                    .clipped()
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollIndicators(.hidden)
        .frame(height: 180)
        .clipShape(.rect(cornerRadius: 14))
        .overlay(alignment: .bottomTrailing) {
            if request.photos.count > 1 {
                Label("\(request.photos.count)", systemImage: "photo.on.rectangle")
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(.regularMaterial, in: .capsule)
                    .padding(8)
            }
        }
    }

    // MARK: - Overview

    private var overviewCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                badge(request.statusLabel, tint: request.statusTint)
                if request.isPremium {
                    badge("Boosted", symbol: "sparkles", tint: .orange)
                }
                if let progress = progressLabel {
                    badge(progress, tint: .blue)
                }
                Spacer(minLength: 0)
            }

            Text(request.title)
                .font(.title3.bold())
                .fixedSize(horizontal: false, vertical: true)

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(request.budget ?? "Open budget")
                    .font(.headline)
                    .foregroundStyle(request.budget == nil ? .secondary : .primary)
                Text(pricingLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 5) {
                Label(request.categoryName, systemImage: request.categorySymbol)
                Label(request.location, systemImage: "mappin")
                    .lineLimit(2)
                if let scheduledAt = request.scheduledAt {
                    Label(
                        scheduledAt.formatted(date: .abbreviated, time: .shortened),
                        systemImage: "calendar"
                    )
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            Divider().opacity(0.35)

            HStack(spacing: 0) {
                compactStat(
                    "\(isOwner ? ownerOffers.count : request.offerCount)",
                    label: "Offers",
                    symbol: "tray.and.arrow.down"
                )
                compactStat("\(request.viewCount)", label: "Views", symbol: "eye")
                compactStat(
                    request.createdAt.formatted(.relative(presentation: .numeric)),
                    label: "Posted",
                    symbol: "clock"
                )
            }
        }
        .detailCard()
    }

    // MARK: - Description

    private var descriptionCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Details")
                .font(.subheadline.weight(.semibold))
            Text(request.description)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .detailCard()
    }

    // MARK: - Requester

    private var requesterCard: some View {
        HStack(spacing: 10) {
            AsyncImage(url: request.requester.avatarUrl) { image in
                image
                    .resizable()
                    .scaledToFill()
            } placeholder: {
                ZStack {
                    Color(.tertiarySystemFill)
                    Image(systemName: "person.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 40, height: 40)
            .clipShape(.circle)

            VStack(alignment: .leading, spacing: 2) {
                Text(request.requester.displayName)
                    .font(.subheadline.weight(.semibold))
                HStack(spacing: 6) {
                    Label(
                        String(format: "%.1f · %d", request.requester.rating, request.requester.reviewCount),
                        systemImage: "star.fill"
                    )
                    Text("·")
                    Text("Since \(request.requester.memberSince.formatted(.dateTime.year()))")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .detailCard()
        .accessibilityElement(children: .combine)
    }

    // MARK: - Message owner

    private var messageOwnerCard: some View {
        Button {
            Task { await openConversation(createIfNeeded: true) }
        } label: {
            if isOpeningChat {
                ProgressView().frame(maxWidth: .infinity)
            } else {
                Label("Message owner", systemImage: "bubble.left.and.bubble.right.fill")
                    .frame(maxWidth: .infinity)
            }
        }
        .buttonStyle(.bordered)
        .font(.subheadline.weight(.semibold))
        .disabled(isOpeningChat)
        .detailCard()
    }

    // MARK: - Location

    private var locationCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text("Location")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(request.city)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Map(
                initialPosition: .region(
                    MKCoordinateRegion(
                        center: request.coordinate,
                        latitudinalMeters: 1_200,
                        longitudinalMeters: 1_200
                    )
                ),
                interactionModes: []
            ) {
                Marker(request.title, systemImage: request.categorySymbol, coordinate: request.coordinate)
                    .tint(request.accentTint)
            }
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .frame(height: 130)
            .clipShape(.rect(cornerRadius: 12))
            .accessibilityLabel("Map showing \(request.location)")

            HStack(spacing: 8) {
                Button {
                    if let directionsURL { openURL(directionsURL) }
                } label: {
                    Label("Directions", systemImage: "arrow.triangle.turn.up.right.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)

                Button {
                    if let mapsURL { openURL(mapsURL) }
                } label: {
                    Label("Maps", systemImage: "map")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
            .font(.caption.weight(.semibold))
            .controlSize(.small)
        }
        .detailCard()
    }

    // MARK: - Job actions

    private var jobActionsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Job", systemImage: "wrench.and.screwdriver.fill")
                .font(.subheadline.weight(.semibold))

            if canOpenConversation {
                Button {
                    Task { await openConversation(createIfNeeded: true) }
                } label: {
                    if isOpeningChat {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Label("Open chat", systemImage: "bubble.left.and.bubble.right.fill")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isOpeningChat)
            }

            if let next = nextProviderProgress {
                Button {
                    Task { await updateProgress(next) }
                } label: {
                    if isUpdatingProgress {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text(progressActionLabel(next))
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.bordered)
                .disabled(isUpdatingProgress)
            }

            if canOwnerComplete {
                Button {
                    Task { await updateRequestStatus(.completed) }
                } label: {
                    if isUpdatingStatus {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Label("Mark completed", systemImage: "checkmark.seal.fill")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .disabled(isUpdatingStatus)
            }

            if canOwnerCancel {
                Button(role: .destructive) {
                    pendingCancel = true
                } label: {
                    Label("Cancel request", systemImage: "xmark.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(isUpdatingStatus)
            }
        }
        .font(.subheadline.weight(.semibold))
        .detailCard()
    }

    private var reviewCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Leave a review", systemImage: "star.fill")
                .font(.subheadline.weight(.semibold))

            Picker("Rating", selection: $reviewRating) {
                ForEach(1...5, id: \.self) { value in
                    Text("\(value) ★").tag(value)
                }
            }
            .pickerStyle(.segmented)

            TextField("Optional comment", text: $reviewBody, axis: .vertical)
                .lineLimit(2...4)
                .textFieldStyle(.roundedBorder)

            Button {
                Task { await submitReview() }
            } label: {
                if isSubmittingReview {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Text("Submit review")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isSubmittingReview)
        }
        .detailCard()
    }

    // MARK: - Offers

    private var ownerOffersSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Offers", systemImage: "tray.and.arrow.down.fill")
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 0)
                if isLoadingOffers {
                    ProgressView()
                        .controlSize(.small)
                }
            }

            if ownerOffers.isEmpty, !isLoadingOffers {
                Text("No offers yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(ownerOffers) { offer in
                    ownerOfferRow(offer)
                    if offer.id != ownerOffers.last?.id {
                        Divider().opacity(0.35)
                    }
                }
            }
        }
        .detailCard()
    }

    private func ownerOfferRow(_ offer: Offer) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                AsyncImage(url: offer.offerer.avatarUrl) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } placeholder: {
                    ZStack {
                        Color(.tertiarySystemFill)
                        Image(systemName: "person.fill")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(width: 32, height: 32)
                .clipShape(.circle)

                VStack(alignment: .leading, spacing: 2) {
                    Text(offer.offerer.displayName)
                        .font(.subheadline.weight(.semibold))
                    Text(
                        String(
                            format: "%.1f · %d reviews",
                            offer.offerer.rating,
                            offer.offerer.reviewCount
                        )
                    )
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)

                VStack(alignment: .trailing, spacing: 4) {
                    if let priceCents = offer.priceCents {
                        Text(priceText(priceCents))
                            .font(.subheadline.weight(.semibold))
                    } else {
                        Text("Interest")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    badge(
                        offer.status.rawValue.capitalized,
                        tint: offerStatusTint(offer.status)
                    )
                }
            }

            if let message = offer.message, !message.isEmpty {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if offer.status == .pending, request.status == .open {
                HStack(spacing: 8) {
                    Button {
                        pendingAcceptOffer = offer
                    } label: {
                        if respondingOfferId == offer.id {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text("Accept")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(respondingOfferId != nil)

                    Button {
                        Task { await respond(to: offer, status: .declined) }
                    } label: {
                        Text("Decline")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(respondingOfferId != nil)
                }
                .font(.caption.weight(.semibold))
                .controlSize(.small)
            }
        }
    }

    private var sendOfferCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(
                isFixedPriceInterest ? "Show interest" : "Send an offer",
                systemImage: "paperplane.fill"
            )
            .font(.subheadline.weight(.semibold))

            if isFixedPriceInterest {
                Text("This request has a fixed price of \(request.budget ?? "the listed amount").")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                TextField("Your price (€)", text: $offerPriceEuros)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
            }

            TextField("Message (optional)", text: $offerMessage, axis: .vertical)
                .lineLimit(2...4)
                .textFieldStyle(.roundedBorder)

            Button {
                Task { await submitOffer() }
            } label: {
                if isSubmittingOffer {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Text(isFixedPriceInterest ? "I’m interested" : "Submit offer")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(!canSubmitOffer)
            .font(.subheadline.weight(.semibold))
        }
        .detailCard()
    }

    private func acceptedOfferCard(_ offer: AcceptedOffer) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Accepted offer", systemImage: "checkmark.seal.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.green)
            HStack {
                Text(offer.provider.displayName)
                    .font(.subheadline.weight(.medium))
                Spacer(minLength: 0)
                if let priceCents = offer.priceCents {
                    Text(priceText(priceCents))
                        .font(.subheadline.weight(.semibold))
                }
            }
            if let message = offer.message, !message.isEmpty {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .detailCard()
    }

    private func viewerOfferCard(_ offer: Offer) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Your offer", systemImage: "paperplane.fill")
                .font(.subheadline.weight(.semibold))
            HStack(spacing: 8) {
                if let priceCents = offer.priceCents {
                    Text(priceText(priceCents))
                        .font(.subheadline.weight(.semibold))
                } else {
                    Text("Interest")
                        .font(.subheadline.weight(.semibold))
                }
                badge(offer.status.rawValue.capitalized, tint: offerStatusTint(offer.status))
            }
            if let message = offer.message, !message.isEmpty {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if offer.status == .pending {
                Button(role: .destructive) {
                    pendingWithdrawOffer = offer
                } label: {
                    if respondingOfferId == offer.id {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text("Withdraw")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(respondingOfferId != nil)
            }
        }
        .detailCard()
    }

    // MARK: - Actions

    private func refreshDetail() async {
        do {
            let response: APIEnvelope<ServiceRequest> = try await auth.api.send(
                path: "requests/\(request.id)",
                authenticated: auth.user != nil
            )
            request = response.data
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func recordViewIfNeeded() async {
        guard !didRecordView, !isOwner else { return }
        didRecordView = true
        let _: APIEnvelope<ServiceRequest>? = try? await auth.api.send(
            "POST",
            path: "requests/\(request.id)/views",
            authenticated: auth.user != nil
        )
        await refreshDetail()
    }

    private func loadOwnerOffers() async {
        guard isOwner else {
            ownerOffers = []
            return
        }
        isLoadingOffers = true
        do {
            let response: APIEnvelope<[Offer]> = try await auth.api.send(
                path: "requests/\(request.id)/offers"
            )
            ownerOffers = response.data
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoadingOffers = false
    }

    private func submitOffer() async {
        guard canSubmitOffer else { return }
        isSubmittingOffer = true
        errorMessage = nil
        successMessage = nil

        let trimmedMessage = offerMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = CreateOfferBody(
            priceCents: isFixedPriceInterest ? nil : offerPriceCents,
            message: trimmedMessage.isEmpty ? nil : trimmedMessage
        )

        do {
            let _: APIEnvelope<Offer> = try await auth.api.send(
                "POST",
                path: "requests/\(request.id)/offers",
                body: body
            )
            offerPriceEuros = ""
            offerMessage = ""
            successMessage = isFixedPriceInterest ? "Interest sent." : "Offer sent."
            await refreshDetail()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSubmittingOffer = false
    }

    private func respond(to offer: Offer, status: OfferStatus) async {
        respondingOfferId = offer.id
        errorMessage = nil
        successMessage = nil
        do {
            let _: APIEnvelope<Offer> = try await auth.api.send(
                "PATCH",
                path: "requests/\(request.id)/offers/\(offer.id)",
                body: UpdateOfferStatusBody(status: status)
            )
            await refreshDetail()
            if isOwner {
                await loadOwnerOffers()
            }
            successMessage = switch status {
            case .accepted: "Offer accepted."
            case .declined: "Offer declined."
            case .withdrawn: "Offer withdrawn."
            case .pending: nil
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        respondingOfferId = nil
    }

    private func updateRequestStatus(_ status: ServiceRequestStatus) async {
        isUpdatingStatus = true
        errorMessage = nil
        successMessage = nil
        do {
            let response: APIEnvelope<ServiceRequest> = try await auth.api.send(
                "PATCH",
                path: "requests/\(request.id)/status",
                body: UpdateRequestStatusBody(status: status)
            )
            request = response.data
            successMessage = status == .completed ? "Job marked completed." : "Request cancelled."
            if isOwner { await loadOwnerOffers() }
        } catch {
            errorMessage = error.localizedDescription
        }
        isUpdatingStatus = false
    }

    private func updateProgress(_ status: JobProgressStatus) async {
        isUpdatingProgress = true
        errorMessage = nil
        successMessage = nil
        do {
            let response: APIEnvelope<ServiceRequest> = try await auth.api.send(
                "PATCH",
                path: "requests/\(request.id)/progress",
                body: UpdateProgressBody(status: status)
            )
            request = response.data
            successMessage = progressActionLabel(status)
        } catch {
            errorMessage = error.localizedDescription
        }
        isUpdatingProgress = false
    }

    private func submitReview() async {
        isSubmittingReview = true
        errorMessage = nil
        successMessage = nil
        let trimmed = reviewBody.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            let _: APIEnvelope<Review> = try await auth.api.send(
                "POST",
                path: "requests/\(request.id)/reviews",
                body: CreateReviewBody(
                    rating: reviewRating,
                    body: trimmed.isEmpty ? nil : trimmed
                )
            )
            hasSubmittedReview = true
            reviewBody = ""
            successMessage = "Review submitted."
        } catch {
            errorMessage = error.localizedDescription
        }
        isSubmittingReview = false
    }

    private func openConversation(createIfNeeded: Bool = false) async {
        isOpeningChat = true
        errorMessage = nil
        do {
            let response: APIEnvelope<RequestConversationPayload> = try await auth.api.send(
                createIfNeeded ? "POST" : "GET",
                path: "requests/\(request.id)/conversation"
            )
            if let id = response.data.id {
                conversationId = id
            } else if createIfNeeded {
                errorMessage = "Couldn’t open chat."
            } else {
                errorMessage = "No conversation yet."
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isOpeningChat = false
    }

    // MARK: - Pieces

    private func compactStat(_ value: String, label: String, symbol: String) -> some View {
        VStack(spacing: 2) {
            Label(value, systemImage: symbol)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    private func badge(_ title: String, symbol: String? = nil, tint: Color) -> some View {
        HStack(spacing: 3) {
            if let symbol {
                Image(systemName: symbol)
            }
            Text(title)
        }
        .font(.caption2.weight(.bold))
        .textCase(.uppercase)
        .foregroundStyle(tint)
        .padding(.horizontal, 7)
        .padding(.vertical, 4)
        .background(tint.opacity(0.14), in: .capsule)
    }

    private func offerStatusTint(_ status: OfferStatus) -> Color {
        switch status {
        case .pending: .orange
        case .accepted: .green
        case .declined, .withdrawn: .secondary
        }
    }

    private var progressLabel: String? {
        guard let progressStatus = request.progressStatus else { return nil }
        return switch progressStatus {
        case .accepted: "Accepted"
        case .onTheWay: "On the way"
        case .started: "Started"
        case .providerDone: "Awaiting confirmation"
        case .ownerConfirmed: "Confirmed"
        }
    }

    private func progressActionLabel(_ status: JobProgressStatus) -> String {
        switch status {
        case .onTheWay: "I’m on the way"
        case .started: "Start the job"
        case .providerDone: "Mark ready for confirmation"
        case .accepted, .ownerConfirmed: "Update progress"
        }
    }

    private var pricingLabel: String {
        switch request.pricingMode {
        case .providerOffers: "Providers send offers"
        case .ownerFixedPrice: "Fixed price"
        }
    }

    private func priceText(_ cents: Int) -> String {
        (Decimal(cents) / 100).formatted(.currency(code: "EUR"))
    }

    private var mapsURL: URL? {
        var components = URLComponents(string: "https://maps.apple.com/")
        components?.queryItems = [
            URLQueryItem(name: "ll", value: "\(request.latitude),\(request.longitude)"),
            URLQueryItem(name: "q", value: request.title)
        ]
        return components?.url
    }

    private var directionsURL: URL? {
        var components = URLComponents(string: "https://maps.apple.com/")
        components?.queryItems = [
            URLQueryItem(name: "daddr", value: "\(request.latitude),\(request.longitude)"),
            URLQueryItem(name: "dirflg", value: "d")
        ]
        return components?.url
    }
}

private extension View {
    func detailCard() -> some View {
        padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 14))
    }
}
