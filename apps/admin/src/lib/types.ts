export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  businessName: string | null;
  preferBusinessName: boolean;
  profileName: string;
  bio: string | null;
  avatarUrl: string | null;
  rating: number;
  reviewCount: number;
  role: "USER" | "ADMIN";
  isDisabled: boolean;
  memberSince: string;
  createdAt?: string;
  updatedAt?: string;
  stats?: {
    requestCount: number;
    offerCount: number;
    reviewCount: number;
  };
};

export type DashboardStats = {
  users: { total: number; disabled: number; admins: number; new7d: number };
  requests: {
    total: number;
    open: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    premium: number;
    new7d: number;
  };
  offers: { total: number; pending: number };
  reviews: { total: number };
  categories: { total: number };
  messaging: { conversations: number; messages: number };
};

export type AdminRequest = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categorySymbol: string;
  city: string;
  location: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  isPremium: boolean;
  budget: string | null;
  budgetCents: number | null;
  offerCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  requester: {
    id: string;
    displayName: string;
    profileName: string;
    email?: string;
  };
};

export type AdminCategory = {
  id: string;
  name: string;
  symbol: string;
  requestCount: number;
};

export type AdminReview = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  author: { id: string; displayName: string; profileName: string };
  subject: { id: string; displayName: string; email: string };
  request: { id: string; title: string } | null;
};

export type AdminOffer = {
  id: string;
  requestId: string;
  priceCents: number | null;
  message: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "WITHDRAWN";
  createdAt: string;
  offerer: { id: string; displayName: string; profileName: string };
  request: { id: string; title: string; status: string };
};

export type ListMeta = {
  total: number;
  limit: number;
  offset: number;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
};
