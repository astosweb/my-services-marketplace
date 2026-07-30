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
    @State private var fullscreenPhoto: RequestPhoto?
    @State private var selectedTab: DetailTab = .details
    @State private var galleryPage: Int? = 0
    @State private var isDescriptionExpanded = false

    private enum DetailTab: String, CaseIterable, Identifiable {
        case details
        case activity
        case offers

        var id: Self { self }

        var label: String {
            switch self {
            case .details: "Details"
            case .activity: "Activity"
            case .offers: "Offers"
            }
        }

        var symbol: String {
            switch self {
            case .details: "doc.text"
            case .activity: "clock.arrow.circlepath"
            case .offers: "tray.and.arrow.down"
            }
        }
    }

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

    private var showJobActions: Bool {
        canOpenConversation || canOwnerCancel
    }

    private var showProgressTracker: Bool {
        request.status == .inProgress || request.progressStatus != nil
    }

    private var trimmedDescription: String {
        request.description.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var offersTabBadge: Int? {
        let count = isOwner ? ownerOffers.count : request.offerCount
        return count > 0 ? count : nil
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                gallery
                overviewCard

                if showProgressTracker {
                    progressTrackerCard
                }

                if let successMessage {
                    feedbackBanner(successMessage, symbol: "checkmark.circle.fill", tint: .green)
                }
                if let errorMessage {
                    feedbackBanner(errorMessage, symbol: "exclamationmark.triangle.fill", tint: .red)
                }

                tabPicker

                tabContent
            }
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 28)
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
        .fullScreenCover(item: $fullscreenPhoto) { photo in
            FullscreenPhotoViewer(photos: request.photos, initial: photo)
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
        .sensoryFeedback(.success, trigger: successMessage)
    }

    private var conversationPeer: OfferUser {
        if isOwner, let accepted = request.acceptedOffer {
            return accepted.provider
        }
        return request.requester
    }

    // MARK: - Gallery

    @ViewBuilder
    private var gallery: some View {
        if request.photos.isEmpty {
            ZStack {
                request.accentTint.opacity(0.12)
                VStack(spacing: 10) {
                    Image(systemName: request.categorySymbol)
                        .font(.system(size: 36, weight: .semibold))
                        .foregroundStyle(request.accentTint)
                    Text(request.categoryName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(request.accentTint)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 160)
            .clipShape(.rect(cornerRadius: 18))
            .accessibilityHidden(true)
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
                                ZStack {
                                    Color(.tertiarySystemFill)
                                    ProgressView()
                                }
                            }
                            .containerRelativeFrame(.horizontal)
                            .frame(height: 240)
                            .clipped()
                            .contentShape(.rect)
                            .onTapGesture { fullscreenPhoto = photo }
                            .accessibilityAddTraits(.isButton)
                            .accessibilityHint("Shows full image")
                            .id(index)
                        }
                    }
                    .scrollTargetLayout()
                }
                .scrollTargetBehavior(.paging)
                .scrollPosition(id: $galleryPage)
                .scrollIndicators(.hidden)
                .frame(height: 240)
                .clipShape(.rect(cornerRadius: 18))

                HStack {
                    if request.isPremium {
                        badge("Boosted", symbol: "sparkles", tint: .orange)
                    }
                    Spacer(minLength: 0)
                    if request.photos.count > 1 {
                        Text("\((galleryPage ?? 0) + 1)/\(request.photos.count)")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .background(.ultraThinMaterial, in: .capsule)
                    }
                }
                .padding(12)

                if request.photos.count > 1 {
                    HStack(spacing: 5) {
                        ForEach(0..<request.photos.count, id: \.self) { index in
                            Capsule()
                                .fill(index == (galleryPage ?? 0) ? Color.white : Color.white.opacity(0.4))
                                .frame(width: index == (galleryPage ?? 0) ? 14 : 5, height: 5)
                                .animation(.snappy(duration: 0.2), value: galleryPage)
                        }
                    }
                    .padding(.bottom, 10)
                    .allowsHitTesting(false)
                }
            }
        }
    }

    // MARK: - Overview

    private var overviewCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 6) {
                badge(request.statusLabel, tint: request.statusTint)
                if let progress = progressLabel {
                    badge(progress, tint: .blue)
                }
                Spacer(minLength: 0)
                Label(request.categoryName, systemImage: request.categorySymbol)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(request.accentTint)
                    .lineLimit(1)
            }

            Text(request.title)
                .font(.title2.bold())
                .fixedSize(horizontal: false, vertical: true)

            if !trimmedDescription.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text(trimmedDescription)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(isDescriptionExpanded ? nil : 3)
                        .fixedSize(horizontal: false, vertical: true)

                    if trimmedDescription.count > 140 {
                        Button(isDescriptionExpanded ? "Show less" : "Read more") {
                            withAnimation(.snappy) {
                                isDescriptionExpanded.toggle()
                            }
                        }
                        .font(.caption.weight(.semibold))
                    }
                }
            }

            Divider().opacity(0.35)

            Text("Posted by")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            requesterRow
        }
        .detailCard()
    }

    private var factsGrid: some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: 10),
                GridItem(.flexible(), spacing: 10)
            ],
            spacing: 10
        ) {
            factCell(
                "Budget",
                value: request.budget ?? "Open",
                symbol: "eurosign.circle",
                emphasized: request.budget != nil
            )
            factCell("Location", value: request.location, symbol: "mappin.and.ellipse")
            if let scheduledAt = request.scheduledAt {
                factCell(
                    "Scheduled",
                    value: scheduledAt.formatted(date: .abbreviated, time: .shortened),
                    symbol: "calendar"
                )
            }
            factCell("Pricing", value: pricingLabel, symbol: "tag")
            factCell(
                "Offers",
                value: "\(isOwner ? ownerOffers.count : request.offerCount)",
                symbol: "tray.and.arrow.down"
            )
            factCell("Views", value: "\(request.viewCount)", symbol: "eye")
        }
        .detailCard()
    }

    private func factCell(
        _ label: String,
        value: String,
        symbol: String,
        emphasized: Bool = false
    ) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(emphasized ? request.accentTint : .secondary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.subheadline.weight(emphasized ? .semibold : .medium))
                    .foregroundStyle(emphasized ? request.accentTint : .primary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 12))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label) \(value)")
    }

    // MARK: - Progress tracker

    private var progressTrackerCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label("Job progress", systemImage: "flag.checkered")
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 0)
                if let progress = progressLabel {
                    Text(progress)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.blue)
                }
            }

            HStack(spacing: 0) {
                ForEach(Array(progressSteps.enumerated()), id: \.offset) { index, step in
                    progressStepView(step, index: index)
                    if index < progressSteps.count - 1 {
                        Rectangle()
                            .fill(step.isComplete ? Color.accentColor : Color(.tertiarySystemFill))
                            .frame(height: 3)
                            .padding(.bottom, 18)
                    }
                }
            }

            if let next = nextProviderProgress {
                Button {
                    Task { await updateProgress(next) }
                } label: {
                    if isUpdatingProgress {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Label(progressActionLabel(next), systemImage: "arrow.right.circle.fill")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isUpdatingProgress)
            } else if canOwnerComplete {
                Button {
                    Task { await updateRequestStatus(.completed) }
                } label: {
                    if isUpdatingStatus {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Label("Confirm & complete job", systemImage: "checkmark.seal.fill")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .controlSize(.large)
                .disabled(isUpdatingStatus)
            }
        }
        .font(.subheadline.weight(.semibold))
        .detailCard()
    }

    private struct ProgressStep: Identifiable {
        let id: String
        let title: String
        let isComplete: Bool
        let isCurrent: Bool
    }

    private var progressSteps: [ProgressStep] {
        let current = request.progressStatus
        let order: [JobProgressStatus] = [.accepted, .onTheWay, .started, .providerDone, .ownerConfirmed]
        let currentIndex = current.flatMap { order.firstIndex(of: $0) } ?? -1

        let labels: [(JobProgressStatus, String)] = [
            (.accepted, "Accepted"),
            (.onTheWay, "On the way"),
            (.started, "Working"),
            (.providerDone, "Ready"),
            (.ownerConfirmed, "Done")
        ]

        return labels.map { status, title in
            let index = order.firstIndex(of: status) ?? 0
            return ProgressStep(
                id: status.rawValue,
                title: title,
                isComplete: index <= currentIndex,
                isCurrent: index == currentIndex
            )
        }
    }

    private func progressStepView(_ step: ProgressStep, index: Int) -> some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .fill(step.isComplete ? Color.accentColor : Color(.tertiarySystemFill))
                    .frame(width: 22, height: 22)
                if step.isComplete {
                    Image(systemName: step.isCurrent ? "circle.fill" : "checkmark")
                        .font(.system(size: step.isCurrent ? 8 : 10, weight: .bold))
                        .foregroundStyle(.white)
                } else {
                    Text("\(index + 1)")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.secondary)
                }
            }
            Text(step.title)
                .font(.caption2.weight(step.isCurrent ? .bold : .medium))
                .foregroundStyle(step.isCurrent ? .primary : .secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(step.title)\(step.isComplete ? ", complete" : "")\(step.isCurrent ? ", current" : "")")
    }

    // MARK: - Tabs

    private var tabPicker: some View {
        HStack(spacing: 6) {
            ForEach(DetailTab.allCases) { tab in
                Button {
                    withAnimation(.snappy(duration: 0.2)) {
                        selectedTab = tab
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: tab.symbol)
                        Text(tab.label)
                        if tab == .offers, let badge = offersTabBadge {
                            Text("\(badge)")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(Color.accentColor, in: .capsule)
                        }
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(selectedTab == tab ? Color.primary : Color.secondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .frame(maxWidth: .infinity)
                    .background(
                        selectedTab == tab
                            ? Color(.secondarySystemGroupedBackground)
                            : Color.clear,
                        in: .rect(cornerRadius: 10)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(
                                selectedTab == tab
                                    ? Color.black.opacity(0.06)
                                    : Color.clear
                            )
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 12))
        .sensoryFeedback(.selection, trigger: selectedTab)
    }

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case .details:
            detailsTab
        case .activity:
            activityTab
        case .offers:
            offersTab
        }
    }

    @ViewBuilder
    private var detailsTab: some View {
        VStack(alignment: .leading, spacing: 12) {
            factsGrid
            if request.isMappable {
                locationCard
            }
            if canMessageOwner {
                messageOwnerCard
            }
            if let accepted = request.acceptedOffer {
                acceptedOfferCard(accepted)
            }
            if showJobActions {
                jobActionsCard
            }
            if canLeaveReview {
                reviewCard
            }
        }
    }

    private var activityTab: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Timeline")
                .font(.subheadline.weight(.semibold))

            VStack(alignment: .leading, spacing: 0) {
                timelineRow(
                    title: "Created",
                    value: request.createdAt.formatted(date: .abbreviated, time: .shortened),
                    detail: request.createdAt.formatted(.relative(presentation: .named)),
                    symbol: "plus.circle.fill",
                    tint: .green,
                    isLast: false
                )
                timelineRow(
                    title: "Last updated",
                    value: request.updatedAt.formatted(date: .abbreviated, time: .shortened),
                    detail: request.updatedAt.formatted(.relative(presentation: .named)),
                    symbol: "arrow.triangle.2.circlepath.circle.fill",
                    tint: .blue,
                    isLast: request.completedAt == nil && request.cancelledAt == nil
                )
                if let completedAt = request.completedAt {
                    timelineRow(
                        title: "Completed",
                        value: completedAt.formatted(date: .abbreviated, time: .shortened),
                        detail: completedAt.formatted(.relative(presentation: .named)),
                        symbol: "checkmark.seal.fill",
                        tint: .green,
                        isLast: true
                    )
                } else if let cancelledAt = request.cancelledAt {
                    timelineRow(
                        title: "Cancelled",
                        value: cancelledAt.formatted(date: .abbreviated, time: .shortened),
                        detail: cancelledAt.formatted(.relative(presentation: .named)),
                        symbol: "xmark.circle.fill",
                        tint: .red,
                        isLast: true
                    )
                }
            }
        }
        .detailCard()
    }

    private func timelineRow(
        title: String,
        value: String,
        detail: String?,
        symbol: String,
        tint: Color,
        isLast: Bool
    ) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 0) {
                Image(systemName: symbol)
                    .font(.body)
                    .foregroundStyle(tint)
                    .frame(width: 28, height: 28)
                if !isLast {
                    Rectangle()
                        .fill(Color(.tertiarySystemFill))
                        .frame(width: 2)
                        .frame(maxHeight: .infinity)
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.subheadline.weight(.medium))
                if let detail {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(.bottom, isLast ? 0 : 16)

            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(detail.map { "\(title) \(value), \($0)" } ?? "\(title) \(value)")
    }

    @ViewBuilder
    private var offersTab: some View {
        VStack(alignment: .leading, spacing: 12) {
            if isOwner {
                ownerOffersSection
            } else if let viewerOffer = request.viewerOffer {
                viewerOfferCard(viewerOffer)
            }
            if canSendOffer {
                sendOfferCard
            }
            if !isOwner, request.viewerOffer == nil, !canSendOffer {
                emptyState(
                    symbol: "tray",
                    title: "No offer yet",
                    detail: request.status == .open
                        ? "Sign in as a provider to send an offer on this request."
                        : "This request is no longer accepting offers."
                )
            }
        }
    }

    // MARK: - Requester

    private var requesterRow: some View {
        HStack(spacing: 12) {
            AsyncImage(url: request.requester.avatarUrl) { image in
                image
                    .resizable()
                    .scaledToFill()
            } placeholder: {
                ZStack {
                    request.accentTint.opacity(0.15)
                    Image(systemName: "person.fill")
                        .font(.body)
                        .foregroundStyle(request.accentTint)
                }
            }
            .frame(width: 48, height: 48)
            .clipShape(.circle)
            .overlay(Circle().strokeBorder(Color.black.opacity(0.06)))

            VStack(alignment: .leading, spacing: 4) {
                Text(request.requester.displayName)
                    .font(.subheadline.weight(.semibold))
                HStack(spacing: 8) {
                    Label(
                        String(format: "%.1f", request.requester.rating),
                        systemImage: "star.fill"
                    )
                    .foregroundStyle(.orange)
                    Text("\(request.requester.reviewCount) reviews")
                        .foregroundStyle(.secondary)
                    Text("·")
                        .foregroundStyle(.tertiary)
                    Text("Since \(request.requester.memberSince.formatted(.dateTime.year()))")
                        .foregroundStyle(.secondary)
                }
                .font(.caption)
                .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Message owner

    private var messageOwnerCard: some View {
        Button {
            Task { await openConversation(createIfNeeded: true) }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "bubble.left.and.bubble.right.fill")
                    .font(.title3)
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(Color.accentColor.gradient, in: .circle)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Message \(request.requester.displayName)")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text("Ask a question before offering")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)

                if isOpeningChat {
                    ProgressView()
                } else {
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(4)
        }
        .buttonStyle(.plain)
        .disabled(isOpeningChat)
        .detailCard()
    }

    // MARK: - Location

    private var locationCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Label("Where", systemImage: "mappin.and.ellipse")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(request.city)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Text(request.location)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

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
            .frame(height: 180)
            .clipShape(.rect(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(Color.black.opacity(0.06))
            )
            .accessibilityLabel("Map showing \(request.location)")

            HStack(spacing: 10) {
                Button {
                    if let directionsURL { openURL(directionsURL) }
                } label: {
                    Label("Directions", systemImage: "arrow.triangle.turn.up.right.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                Button {
                    if let mapsURL { openURL(mapsURL) }
                } label: {
                    Label("Open Maps", systemImage: "map")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
            }
            .font(.subheadline.weight(.semibold))
        }
        .detailCard()
    }

    // MARK: - Job actions

    private var jobActionsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Actions", systemImage: "bolt.fill")
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
                .controlSize(.large)
                .disabled(isOpeningChat)
            }

            if canOwnerCancel {
                Button(role: .destructive) {
                    pendingCancel = true
                } label: {
                    Label("Cancel request", systemImage: "xmark.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(isUpdatingStatus)
            }
        }
        .font(.subheadline.weight(.semibold))
        .detailCard()
    }

    private var reviewCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("How did it go?", systemImage: "star.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.orange)

            Text("Your review helps others choose with confidence.")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack(spacing: 10) {
                ForEach(1...5, id: \.self) { value in
                    Button {
                        reviewRating = value
                    } label: {
                        Image(systemName: value <= reviewRating ? "star.fill" : "star")
                            .font(.title2)
                            .foregroundStyle(value <= reviewRating ? Color.orange : Color.secondary.opacity(0.35))
                            .symbolEffect(.bounce, value: reviewRating == value)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(value) stars")
                }
            }
            .frame(maxWidth: .infinity)
            .sensoryFeedback(.selection, trigger: reviewRating)

            TextField("Share a short comment (optional)", text: $reviewBody, axis: .vertical)
                .lineLimit(2...4)
                .padding(12)
                .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 10))

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
            .controlSize(.large)
            .disabled(isSubmittingReview)
        }
        .detailCard()
    }

    // MARK: - Offers

    private var ownerOffersSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Offers", systemImage: "tray.and.arrow.down.fill")
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 0)
                if isLoadingOffers {
                    ProgressView()
                        .controlSize(.small)
                } else if !ownerOffers.isEmpty {
                    Text("\(ownerOffers.count)")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color(.tertiarySystemFill), in: .capsule)
                }
            }

            if ownerOffers.isEmpty, !isLoadingOffers {
                emptyState(
                    symbol: "tray",
                    title: "Waiting for offers",
                    detail: "Providers nearby can send proposals. You’ll see them here."
                )
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
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                AsyncImage(url: offer.offerer.avatarUrl) { image in
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

                VStack(alignment: .leading, spacing: 3) {
                    Text(offer.offerer.displayName)
                        .font(.subheadline.weight(.semibold))
                    Label(
                        String(
                            format: "%.1f · %d reviews",
                            offer.offerer.rating,
                            offer.offerer.reviewCount
                        ),
                        systemImage: "star.fill"
                    )
                    .font(.caption)
                    .foregroundStyle(.orange)
                }

                Spacer(minLength: 0)

                VStack(alignment: .trailing, spacing: 4) {
                    if let priceCents = offer.priceCents {
                        Text(priceText(priceCents))
                            .font(.headline)
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
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 10))
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
                            Label("Accept", systemImage: "checkmark")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(respondingOfferId != nil)

                    Button {
                        Task { await respond(to: offer, status: .declined) }
                    } label: {
                        Text("Decline")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .disabled(respondingOfferId != nil)
                }
                .font(.subheadline.weight(.semibold))
            }
        }
        .padding(.vertical, 4)
    }

    private var sendOfferCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(
                isFixedPriceInterest ? "Show interest" : "Send an offer",
                systemImage: "paperplane.fill"
            )
            .font(.subheadline.weight(.semibold))

            if isFixedPriceInterest {
                HStack(spacing: 10) {
                    Image(systemName: "tag.fill")
                        .foregroundStyle(request.accentTint)
                    Text("Fixed price of \(request.budget ?? "the listed amount"). No counter-offer needed.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(request.accentTint.opacity(0.1), in: .rect(cornerRadius: 10))
            } else {
                HStack(spacing: 8) {
                    Text("€")
                        .font(.title3.bold())
                        .foregroundStyle(.secondary)
                    TextField("Your price", text: $offerPriceEuros)
                        .keyboardType(.decimalPad)
                        .font(.title3.bold())
                }
                .padding(12)
                .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 10))
            }

            TextField("Add a short message (optional)", text: $offerMessage, axis: .vertical)
                .lineLimit(2...4)
                .padding(12)
                .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 10))

            Button {
                Task { await submitOffer() }
            } label: {
                if isSubmittingOffer {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Label(
                        isFixedPriceInterest ? "I’m interested" : "Submit offer",
                        systemImage: "paperplane.fill"
                    )
                    .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!canSubmitOffer)
            .font(.subheadline.weight(.semibold))
        }
        .detailCard()
    }

    private func acceptedOfferCard(_ offer: AcceptedOffer) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Accepted provider", systemImage: "checkmark.seal.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.green)

            HStack(spacing: 12) {
                AsyncImage(url: offer.provider.avatarUrl) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } placeholder: {
                    ZStack {
                        Color.green.opacity(0.15)
                        Image(systemName: "person.fill")
                            .foregroundStyle(.green)
                    }
                }
                .frame(width: 44, height: 44)
                .clipShape(.circle)

                VStack(alignment: .leading, spacing: 2) {
                    Text(offer.provider.displayName)
                        .font(.subheadline.weight(.semibold))
                    if let priceCents = offer.priceCents {
                        Text(priceText(priceCents))
                            .font(.headline)
                            .foregroundStyle(.green)
                    }
                }

                Spacer(minLength: 0)
            }

            if let message = offer.message, !message.isEmpty {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .detailCard()
    }

    private func viewerOfferCard(_ offer: Offer) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Your offer", systemImage: "paperplane.fill")
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 0)
                badge(offer.status.rawValue.capitalized, tint: offerStatusTint(offer.status))
            }

            if let priceCents = offer.priceCents {
                Text(priceText(priceCents))
                    .font(.title2.bold())
            } else {
                Text("Interest registered")
                    .font(.title3.bold())
            }

            if let message = offer.message, !message.isEmpty {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 10))
            }

            if offer.status == .pending {
                Button(role: .destructive) {
                    pendingWithdrawOffer = offer
                } label: {
                    if respondingOfferId == offer.id {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text("Withdraw offer")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(respondingOfferId != nil)
            }
        }
        .detailCard()
    }

    // MARK: - Shared UI

    private func feedbackBanner(_ message: String, symbol: String, tint: Color) -> some View {
        Label(message, systemImage: symbol)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(tint)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(tint.opacity(0.12), in: .rect(cornerRadius: 12))
            .transition(.move(edge: .top).combined(with: .opacity))
    }

    private func emptyState(symbol: String, title: String, detail: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(width: 56, height: 56)
                .background(Color(.tertiarySystemFill), in: .circle)
            Text(title)
                .font(.subheadline.weight(.semibold))
            Text(detail)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
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

private struct FullscreenPhotoViewer: View {
    @Environment(\.dismiss) private var dismiss

    let photos: [RequestPhoto]
    @State private var selection: String

    init(photos: [RequestPhoto], initial: RequestPhoto) {
        self.photos = photos
        _selection = State(initialValue: initial.id)
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            TabView(selection: $selection) {
                ForEach(photos) { photo in
                    AsyncImage(url: photo.url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFit()
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
                    .tag(photo.id)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: photos.count > 1 ? .automatic : .never))
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

private extension View {
    func detailCard() -> some View {
        padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(Color.black.opacity(0.05))
            )
    }
}
