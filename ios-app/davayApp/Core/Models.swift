import Foundation

struct APIEnvelope<Value: Decodable>: Decodable {
    let data: Value
}

struct PaginatedEnvelope<Value: Decodable, Meta: Decodable>: Decodable {
    let data: Value
    let meta: Meta
}

struct APIErrorEnvelope: Decodable {
    let error: APIErrorBody
}

struct APIErrorBody: Decodable {
    let message: String
    let code: String?
}

struct User: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var displayName: String
    var bio: String?
    let avatarUrl: URL?
    let rating: Double
    let reviewCount: Int
    let memberSince: Date
    let email: String?
}

struct AuthPayload: Decodable, Sendable {
    let user: User
    let accessToken: String
    let refreshToken: String
}

struct AuthRequest: Encodable {
    let email: String
    let password: String
}

struct RegisterRequest: Encodable {
    let email: String
    let password: String
    let displayName: String
}

struct RefreshRequest: Encodable {
    let refreshToken: String
}

struct ProfileUpdate: Encodable {
    let displayName: String?
    let bio: String?
    let avatarKey: String?

    init(displayName: String? = nil, bio: String? = nil, avatarKey: String? = nil) {
        self.displayName = displayName
        self.bio = bio
        self.avatarKey = avatarKey
    }

    enum CodingKeys: String, CodingKey {
        case displayName, bio, avatarKey
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(displayName, forKey: .displayName)
        try container.encodeIfPresent(bio, forKey: .bio)
        try container.encodeIfPresent(avatarKey, forKey: .avatarKey)
    }
}

struct ProfileStats: Decodable, Sendable {
    let postedCount: Int
    let completedCount: Int
    let reviewCount: Int
}

enum RequestPricingMode: String, Codable, CaseIterable, Identifiable, Sendable {
    case providerOffers = "PROVIDER_OFFERS"
    case ownerFixedPrice = "OWNER_FIXED_PRICE"

    var id: Self { self }

    var label: String {
        switch self {
        case .providerOffers: "Providers offer prices"
        case .ownerFixedPrice: "Fixed price"
        }
    }
}

enum EstonianCity: String, Codable, CaseIterable, Identifiable, Sendable {
    case tallinn = "TALLINN"
    case tartu = "TARTU"
    case parnu = "PARNU"
    case narva = "NARVA"

    var id: Self { self }

    var displayName: String {
        switch self {
        case .tallinn: "Tallinn"
        case .tartu: "Tartu"
        case .parnu: "Pärnu"
        case .narva: "Narva"
        }
    }

    var center: (latitude: Double, longitude: Double) {
        switch self {
        case .tallinn: (59.437, 24.7536)
        case .tartu: (58.378, 26.729)
        case .parnu: (58.3859, 24.4971)
        case .narva: (59.3797, 28.1791)
        }
    }
}

struct Category: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let symbol: String
}

struct CreateRequestBody: Encodable {
    let categoryId: String
    let title: String
    let description: String
    let city: String
    let latitude: Double
    let longitude: Double
    let location: String
    let budgetCents: Int?
    let budgetLabel: String?
    let pricingMode: RequestPricingMode?
    let photoKeys: [String]?

    enum CodingKeys: String, CodingKey {
        case categoryId, title, description, city, latitude, longitude, location
        case budgetCents, budgetLabel, pricingMode, photoKeys
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(categoryId, forKey: .categoryId)
        try container.encode(title, forKey: .title)
        try container.encode(description, forKey: .description)
        try container.encode(city, forKey: .city)
        try container.encode(latitude, forKey: .latitude)
        try container.encode(longitude, forKey: .longitude)
        try container.encode(location, forKey: .location)
        try container.encodeIfPresent(budgetCents, forKey: .budgetCents)
        try container.encodeIfPresent(budgetLabel, forKey: .budgetLabel)
        try container.encodeIfPresent(pricingMode, forKey: .pricingMode)
        try container.encodeIfPresent(photoKeys, forKey: .photoKeys)
    }
}

enum ServiceRequestStatus: String, Codable, Sendable {
    case open = "OPEN"
    case inProgress = "IN_PROGRESS"
    case completed = "COMPLETED"
    case cancelled = "CANCELLED"
}

enum JobProgressStatus: String, Codable, Sendable {
    case accepted = "ACCEPTED"
    case onTheWay = "ON_THE_WAY"
    case started = "STARTED"
    case providerDone = "PROVIDER_DONE"
    case ownerConfirmed = "OWNER_CONFIRMED"
}

enum OfferStatus: String, Codable, Sendable {
    case pending = "PENDING"
    case accepted = "ACCEPTED"
    case declined = "DECLINED"
    case withdrawn = "WITHDRAWN"
}

struct RequestPhoto: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let url: URL
    let sortOrder: Int
}

struct OfferUser: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let displayName: String
    let bio: String?
    let avatarUrl: URL?
    let rating: Double
    let reviewCount: Int
    let memberSince: Date
}

struct AcceptedOffer: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let priceCents: Int?
    let message: String?
    let createdAt: Date
    let provider: OfferUser
}

struct Offer: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let requestId: String
    let priceCents: Int?
    let message: String?
    let status: OfferStatus
    let createdAt: Date
    let offerer: OfferUser
}

struct CreateOfferBody: Encodable {
    let priceCents: Int?
    let message: String?

    enum CodingKeys: String, CodingKey {
        case priceCents, message
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(priceCents, forKey: .priceCents)
        try container.encodeIfPresent(message, forKey: .message)
    }
}

struct UpdateOfferStatusBody: Encodable {
    let status: OfferStatus
}

struct ServiceRequest: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let categoryId: String
    let categoryName: String
    let categorySymbol: String
    let title: String
    let description: String
    let city: String
    let latitude: Double
    let longitude: Double
    let location: String
    let budgetCents: Int?
    let budget: String?
    let scheduledAt: Date?
    let pricingMode: RequestPricingMode
    let status: ServiceRequestStatus
    let progressStatus: JobProgressStatus?
    let progressUpdatedAt: Date?
    let completedAt: Date?
    let cancelledAt: Date?
    let isPremium: Bool
    let offerCount: Int
    let viewCount: Int
    let createdAt: Date
    let updatedAt: Date
    let photos: [RequestPhoto]
    let requester: OfferUser
    let acceptedOffer: AcceptedOffer?
    let viewerOffer: Offer?
}

struct PageMeta: Decodable, Sendable {
    let total: Int
    let limit: Int
    let offset: Int
}

struct ConversationMeta: Decodable, Sendable {
    let unreadCount: Int
}

struct LastMessage: Codable, Hashable, Sendable {
    let body: String
    let createdAt: Date
    let senderId: String
}

struct Conversation: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let requestId: String
    let requestTitle: String
    let categoryId: String
    let categoryName: String
    let categorySymbol: String
    let participant: OfferUser
    let lastMessage: LastMessage?
    let updatedAt: Date
    let unreadCount: Int
    let isPinned: Bool
    let isArchived: Bool
}

enum MessageStatus: String, Codable, Sendable {
    case sending = "SENDING"
    case sent = "SENT"
    case delivered = "DELIVERED"
    case read = "READ"
}

struct Attachment: Codable, Hashable, Sendable {
    let url: URL
    let name: String
    let mimeType: String
}

struct Message: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let conversationId: String
    let body: String
    let status: MessageStatus
    let createdAt: Date
    let sender: OfferUser
    let attachment: Attachment?
}

struct UpdateRequestStatusBody: Encodable {
    let status: ServiceRequestStatus
}

struct UpdateProgressBody: Encodable {
    let status: JobProgressStatus
}

struct CreateReviewBody: Encodable {
    let rating: Int
    let body: String?
}

struct Review: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let rating: Int
    let body: String?
    let createdAt: Date
    let author: OfferUser
}

struct UploadKeysResponse: Decodable, Sendable {
    let keys: [String]
}

struct UploadAttachmentResponse: Decodable, Sendable {
    let key: String
    let name: String
    let mimeType: String
}

struct UploadAvatarResponse: Decodable, Sendable {
    let key: String
}

struct RequestConversationPayload: Decodable, Sendable {
    let id: String?
    let messages: [Message]
}

struct ConversationActionResponse: Decodable, Sendable {
    let id: String
    let isArchived: Bool?
    let isPinned: Bool?
}

struct ArchiveConversationBody: Encodable {
    let isArchived: Bool
}

struct PinConversationBody: Encodable {
    let isPinned: Bool
}

struct SendMessageRequest: Encodable {
    let body: String?
    let attachmentKey: String?
    let attachmentName: String?
    let attachmentMimeType: String?

    init(
        body: String? = nil,
        attachmentKey: String? = nil,
        attachmentName: String? = nil,
        attachmentMimeType: String? = nil
    ) {
        self.body = body
        self.attachmentKey = attachmentKey
        self.attachmentName = attachmentName
        self.attachmentMimeType = attachmentMimeType
    }

    enum CodingKeys: String, CodingKey {
        case body, attachmentKey, attachmentName, attachmentMimeType
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(body, forKey: .body)
        try container.encodeIfPresent(attachmentKey, forKey: .attachmentKey)
        try container.encodeIfPresent(attachmentName, forKey: .attachmentName)
        try container.encodeIfPresent(attachmentMimeType, forKey: .attachmentMimeType)
    }
}

enum NotificationKind: String, Codable, Sendable {
    case newOffer = "NEW_OFFER"
    case offerAccepted = "OFFER_ACCEPTED"
    case offerDeclined = "OFFER_DECLINED"
    case newMessage = "NEW_MESSAGE"
    case jobCompleted = "JOB_COMPLETED"
    case review = "REVIEW"
    case premiumBoost = "PREMIUM_BOOST"
    case paymentReceived = "PAYMENT_RECEIVED"
    case reminder = "REMINDER"
    case system = "SYSTEM"
}

struct AppNotification: Decodable, Identifiable, Sendable {
    let id: String
    let kind: NotificationKind
    let title: String
    let body: String
    let contextTag: String?
    let payload: JSONValue?
    let isRead: Bool
    let createdAt: Date
}

struct NotificationMeta: Decodable, Sendable {
    let total: Int
    let limit: Int
    let offset: Int
    let unreadCount: Int
}

enum JSONValue: Codable, Sendable {
    case string(String)
    case number(Double)
    case boolean(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .boolean(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([String: JSONValue].self) { self = .object(value) }
        else { self = .array(try container.decode([JSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .boolean(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    func stringValue(for key: String) -> String? {
        guard case .object(let object) = self else { return nil }
        guard case .string(let value) = object[key] else { return nil }
        return value
    }
}

struct OKResponse: Decodable, Sendable {
    let ok: Bool
}

struct ForgotPasswordRequest: Encodable {
    let email: String
}

struct ForgotPasswordResponse: Decodable, Sendable {
    let message: String
    let token: String?
    let resetLink: String?
}

struct ResetPasswordRequest: Encodable {
    let token: String
    let password: String
}
