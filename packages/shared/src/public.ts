import { z } from "zod";

export const ESTONIAN_CITIES = ["TALLINN", "TARTU", "PARNU", "NARVA"] as const;
export type EstonianCity = (typeof ESTONIAN_CITIES)[number];

export const CITY_LABELS: Record<EstonianCity, string> = {
  TALLINN: "Tallinn",
  TARTU: "Tartu",
  PARNU: "Pärnu",
  NARVA: "Narva",
};

export type PublicUser = {
  id: string;
  displayName: string;
  businessName: string | null;
  preferBusinessName: boolean;
  profileName: string;
  bio: string | null;
  avatarUrl: string | null;
  rating: number;
  reviewCount: number;
  memberSince: string;
};

export type MeUser = PublicUser & {
  email: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "BANNED";
  permissions?: string[];
};

export type AuthTokensResponse = {
  user: MeUser;
  accessToken: string;
  refreshToken: string;
};

export type RequestPhoto = {
  id: string;
  key: string;
  url: string;
  sortOrder: number;
};

export type MarketplaceOffer = {
  id: string;
  requestId: string;
  priceCents: number | null;
  message: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "WITHDRAWN";
  createdAt: string;
  offerer: PublicUser;
};

export type MarketplaceRequest = {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySymbol: string;
  title: string;
  description: string;
  city: string;
  latitude: number;
  longitude: number;
  location: string;
  budgetCents: number | null;
  budget: string | null;
  scheduledAt: string | null;
  pricingMode: "PROVIDER_OFFERS" | "OWNER_FIXED_PRICE";
  status:
    | "PENDING_REVIEW"
    | "OPEN"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";
  progressStatus: string | null;
  progressUpdatedAt: string | null;
  progressEvents: Array<{ id: string; status: string; createdAt: string }>;
  completedAt: string | null;
  cancelledAt: string | null;
  rejectionReason: string | null;
  isPremium: boolean;
  offerCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  photos: RequestPhoto[];
  requester: PublicUser;
  acceptedOffer: {
    id: string;
    priceCents: number | null;
    message: string | null;
    createdAt: string;
    provider: PublicUser;
  } | null;
  viewerOffer: MarketplaceOffer | null;
};

export type InboxConversation = {
  id: string;
  requestId: string;
  requestTitle: string;
  categoryId: string;
  categoryName: string;
  categorySymbol: string;
  participant: PublicUser;
  lastMessage: {
    body: string;
    createdAt: string;
    senderId: string;
  } | null;
  updatedAt: string;
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  body: string;
  status: string;
  createdAt: string;
  sender: PublicUser;
  attachment: {
    url: string;
    name: string;
    mimeType: string;
  } | null;
};

export type UserStats = {
  postedCount: number;
  completedCount: number;
  reviewCount: number;
};

/** Limits match Nest `CreateRequestDto`. */
export const createRequestSchema = z
  .object({
    categoryId: z.string().min(1),
    title: z.string().min(3).max(200),
    description: z.string().min(10).max(5000),
    city: z.enum(ESTONIAN_CITIES),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    location: z.string().max(500).default(""),
    budgetCents: z.number().int().positive().optional(),
    budgetLabel: z.string().max(50).optional(),
    scheduledAt: z.string().optional(),
    pricingMode: z
      .enum(["PROVIDER_OFFERS", "OWNER_FIXED_PRICE"])
      .default("PROVIDER_OFFERS"),
    isPremium: z.boolean().optional(),
    photoKeys: z.array(z.string().max(500)).max(9).optional(),
  })
  .refine(
    (data) =>
      data.pricingMode !== "OWNER_FIXED_PRICE" || data.budgetCents != null,
    {
      message: "Fixed price requires a budget",
      path: ["budgetCents"],
    },
  );

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const createOfferSchema = z.object({
  priceCents: z.number().int().positive().optional(),
  message: z.string().max(2000).optional(),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;

export const updateOfferStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED", "WITHDRAWN"]),
});

export type UpdateOfferStatusInput = z.infer<typeof updateOfferStatusSchema>;

export const updateRequestStatusSchema = z.object({
  status: z.enum(["COMPLETED", "CANCELLED"]),
});

export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusSchema>;

export const updateProgressSchema = z.object({
  status: z.enum(["ON_THE_WAY", "STARTED", "PROVIDER_DONE"]),
});

export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().max(1000).optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const sendMessageSchema = z.object({
  body: z.string().max(5000).optional(),
  attachmentKey: z.string().optional(),
  attachmentName: z.string().max(255).optional(),
  attachmentMimeType: z.string().max(100).optional(),
});

/** Default map coordinates for Estonian cities (create-request fallbacks). */
export const CITY_COORDINATES: Record<
  EstonianCity,
  { latitude: number; longitude: number }
> = {
  TALLINN: { latitude: 59.437, longitude: 24.7536 },
  TARTU: { latitude: 58.378, longitude: 26.729 },
  PARNU: { latitude: 58.3859, longitude: 24.4971 },
  NARVA: { latitude: 59.3797, longitude: 28.1791 },
};
