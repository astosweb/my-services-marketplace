"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationDto, Paginated } from "@monorepo/shared";
import { api, apiQuery } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";

export type NotificationsList = Paginated<NotificationDto> & {
  meta: Paginated<NotificationDto>["meta"] & { unreadCount: number };
};

export function useNotifications(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn: () =>
      api.get<NotificationsList>(
        `/notifications${apiQuery({
          limit: params?.limit ?? 20,
          offset: params?.offset ?? 0,
        })}`,
      ),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/notifications/${id}`, { isRead: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    },
  });
}
