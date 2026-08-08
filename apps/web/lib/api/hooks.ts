"use client";

import { useQuery } from "@tanstack/react-query";
import { api, apiQuery } from "@/lib/api/client";
import { queryKeys, requestsPath } from "@/lib/api/keys";
import type {
  CategoryDto,
  ConversationMessage,
  InboxConversation,
  MarketplaceRequest,
  NotificationDto,
  Paginated,
  PublicUser,
  ReviewDto,
  UserStats,
} from "@monorepo/shared";

export type RequestsParams = {
  city?: string;
  categoryId?: string;
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => api.get<CategoryDto[]>("/categories"),
  });
}

export function useRequests(params: RequestsParams = {}) {
  return useQuery({
    queryKey: queryKeys.requests(params),
    queryFn: () =>
      api.get<Paginated<MarketplaceRequest>>(requestsPath(params)),
  });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.request(id),
    queryFn: () => api.get<MarketplaceRequest>(`/requests/${id}`),
    enabled: Boolean(id),
  });
}

export function useMyRequests(role: "owner" | "provider") {
  return useQuery({
    queryKey: queryKeys.myRequests(role),
    queryFn: () =>
      api.get<Paginated<MarketplaceRequest>>(
        `/requests/mine${apiQuery({ role, limit: 100 })}`,
      ),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.user(id),
    queryFn: () => api.get<PublicUser>(`/users/${id}`),
    enabled: Boolean(id),
  });
}

export function useUserReviews(id: string) {
  return useQuery({
    queryKey: queryKeys.userReviews(id),
    queryFn: () =>
      api.get<Paginated<ReviewDto>>(
        `/users/${id}/reviews${apiQuery({ limit: 50 })}`,
      ),
    enabled: Boolean(id),
  });
}

export function useNotifications(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn: () =>
      api.get<Paginated<NotificationDto>>(
        `/notifications${apiQuery(params ?? {})}`,
      ),
  });
}

export function useConversations(archived?: boolean, enabled = true) {
  return useQuery({
    queryKey: queryKeys.conversations(archived),
    queryFn: () =>
      api.get<Paginated<InboxConversation>>(
        `/conversations${apiQuery({
          archived: archived ? "true" : undefined,
        })}`,
      ),
    enabled,
  });
}

export function useMessages(id: string) {
  return useQuery({
    queryKey: queryKeys.messages(id),
    queryFn: () =>
      api.get<ConversationMessage[]>(`/conversations/${id}/messages`),
    enabled: Boolean(id),
  });
}

export function useMeStats() {
  return useQuery({
    queryKey: queryKeys.meStats,
    queryFn: () => api.get<UserStats>("/auth/me/stats"),
  });
}
