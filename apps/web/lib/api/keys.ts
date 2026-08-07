import { apiQuery } from "@/lib/api/client";

export const queryKeys = {
  session: ["session"] as const,
  categories: ["categories"] as const,
  requests: (params?: Record<string, string | number | undefined>) =>
    ["requests", params ?? {}] as const,
  request: (id: string) => ["requests", id] as const,
  myRequests: (role: string) => ["requests", "mine", role] as const,
  requestOffers: (id: string) => ["requests", id, "offers"] as const,
  user: (id: string) => ["users", id] as const,
  userReviews: (id: string) => ["users", id, "reviews"] as const,
  meStats: ["auth", "me", "stats"] as const,
  notifications: (params?: Record<string, number | undefined>) =>
    ["notifications", params ?? {}] as const,
  notificationPreferences: ["notifications", "preferences"] as const,
  conversations: (archived?: boolean) =>
    ["conversations", { archived }] as const,
  messages: (id: string) => ["conversations", id, "messages"] as const,
  favorites: ["favorites"] as const,
};

export function requestsPath(params: {
  city?: string;
  categoryId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return `/requests${apiQuery(params)}`;
}
