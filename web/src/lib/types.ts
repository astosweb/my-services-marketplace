export type ServiceRequestStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type RequestPricingMode = "PROVIDER_OFFERS" | "OWNER_FIXED_PRICE";

export type OfferUser = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  rating: number;
  reviewCount: number;
  memberSince: string;
};

export type RequestPhoto = {
  id: string;
  key: string | null;
  url: string;
  sortOrder: number;
};

export type ServiceRequest = {
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
  pricingMode: RequestPricingMode;
  status: ServiceRequestStatus;
  progressStatus: string | null;
  progressUpdatedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  isPremium: boolean;
  offerCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  photos: RequestPhoto[];
  requester: OfferUser;
  acceptedOffer: unknown | null;
  viewerOffer: unknown | null;
};

export type Category = {
  id: string;
  name: string;
  symbol: string;
};

export type PageMeta = {
  total: number;
  limit: number;
  offset: number;
};

export type User = OfferUser & {
  email?: string | null;
};

export type AuthPayload = {
  user: User;
  accessToken: string;
  refreshToken: string;
};
