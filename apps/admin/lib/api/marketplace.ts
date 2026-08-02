"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  ConversationDto,
  ConversationDetailDto,
  OfferDto,
  OfferStatus,
  Paginated,
  ReviewDto,
  ServiceRequestDto,
  ServiceRequestStatus,
  CategoryDto,
  RoleDto,
  PermissionDto,
  SystemStatusDto,
} from "@monorepo/shared";
import { api, apiQuery } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { useApiMutation } from "@/lib/api/use-api-mutation";

export type ListParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortOrder?: "asc" | "desc";
  status?: string;
  categoryId?: string;
  city?: string;
  requestId?: string;
};

function toQuery(params: ListParams) {
  const limit = params.limit ?? 20;
  const page = params.page ?? 1;
  return {
    limit,
    offset: (page - 1) * limit,
    search: params.search,
    sortOrder: params.sortOrder,
    status: params.status,
    categoryId: params.categoryId,
    city: params.city,
    requestId: params.requestId,
  };
}

export function useRequests(params: ListParams) {
  const query = toQuery(params);
  return useQuery({
    queryKey: queryKeys.requests(query),
    queryFn: () =>
      api.get<Paginated<ServiceRequestDto>>(
        `/admin/requests${apiQuery(query)}`,
      ),
    placeholderData: (previous) => previous,
  });
}

export function useUpdateRequest() {
  return useApiMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      title?: string;
      description?: string;
      status?: ServiceRequestStatus;
      isPremium?: boolean;
    }) => api.patch<ServiceRequestDto>(`/admin/requests/${id}`, input),
    successMessage: "Request updated",
    invalidate: [queryKeys.requests(), queryKeys.dashboard],
  });
}

export function useDeleteRequest() {
  return useApiMutation({
    mutationFn: (id: string) =>
      api.delete<{ deleted: true }>(`/admin/requests/${id}`),
    successMessage: "Request deleted",
    invalidate: [queryKeys.requests(), queryKeys.dashboard],
  });
}

export function useOffers(params: ListParams) {
  const query = toQuery(params);
  return useQuery({
    queryKey: queryKeys.offers(query),
    queryFn: () =>
      api.get<Paginated<OfferDto>>(`/admin/offers${apiQuery(query)}`),
    placeholderData: (previous) => previous,
  });
}

export function useUpdateOffer() {
  return useApiMutation({
    mutationFn: ({ id, status }: { id: string; status: OfferStatus }) =>
      api.patch<OfferDto>(`/admin/offers/${id}`, { status }),
    successMessage: "Offer updated",
    invalidate: [queryKeys.offers(), queryKeys.requests(), queryKeys.dashboard],
  });
}

export function useDeleteOffer() {
  return useApiMutation({
    mutationFn: (id: string) =>
      api.delete<{ deleted: true }>(`/admin/offers/${id}`),
    successMessage: "Offer deleted",
    invalidate: [queryKeys.offers(), queryKeys.dashboard],
  });
}

export function useReviews(params: ListParams) {
  const query = toQuery(params);
  return useQuery({
    queryKey: queryKeys.reviews(query),
    queryFn: () =>
      api.get<Paginated<ReviewDto>>(`/admin/reviews${apiQuery(query)}`),
    placeholderData: (previous) => previous,
  });
}

export function useDeleteReview() {
  return useApiMutation({
    mutationFn: (id: string) =>
      api.delete<{ deleted: true }>(`/admin/reviews/${id}`),
    successMessage: "Review deleted",
    invalidate: [queryKeys.reviews(), queryKeys.users(), queryKeys.dashboard],
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => api.get<CategoryDto[]>("/admin/categories"),
  });
}

export function useConversations(params: ListParams) {
  const query = toQuery(params);
  return useQuery({
    queryKey: queryKeys.conversations(query),
    queryFn: () =>
      api.get<Paginated<ConversationDto>>(
        `/admin/conversations${apiQuery(query)}`,
      ),
    placeholderData: (previous) => previous,
  });
}

export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["admin", "conversations", conversationId, "messages"],
    queryFn: () =>
      api.get<ConversationDetailDto>(
        `/admin/conversations/${conversationId}/messages`,
      ),
    enabled: Boolean(conversationId),
  });
}

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.roles,
    queryFn: () => api.get<RoleDto[]>("/admin/roles"),
  });
}

export function usePermissionsCatalog() {
  return useQuery({
    queryKey: queryKeys.permissions,
    queryFn: () => api.get<PermissionDto[]>("/admin/permissions"),
  });
}

export function useSystemStatus() {
  return useQuery({
    queryKey: queryKeys.systemStatus,
    queryFn: () => api.get<SystemStatusDto>("/admin/system/status"),
    refetchInterval: 30_000,
  });
}
