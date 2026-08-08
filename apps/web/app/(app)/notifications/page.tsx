"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { NotificationDto } from "@monorepo/shared";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { useNotifications } from "@/lib/api/hooks";
import { cn, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

function notificationHref(notification: NotificationDto): string | null {
  const payload = notification.payload ?? {};
  const conversationId = payload.conversationId;
  const ticketId = payload.ticketId;
  const requestId = payload.requestId;
  if (typeof conversationId === "string" && conversationId) {
    return `/messages/${conversationId}`;
  }
  if (typeof ticketId === "string" && ticketId) {
    return `/support/${ticketId}`;
  }
  if (typeof requestId === "string" && requestId) {
    return `/requests/${requestId}`;
  }
  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useNotifications({ limit: 50 });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/notifications/${id}`, { isRead: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const readAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: async () => {
      toast.success("All notifications marked read");
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: () => toast.error("Could not mark all as read"),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Notifications
          </h1>
          <p className="mt-2 text-muted-foreground">
            Updates about offers, messages, and jobs.
            {data?.meta.unreadCount
              ? ` ${data.meta.unreadCount} unread.`
              : ""}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={readAll.isPending || !data?.meta.unreadCount}
          onClick={() => readAll.mutate()}
        >
          Mark all read
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          description="Notifications failed to load."
          onRetry={() => void refetch()}
        />
      ) : !data?.items.length ? (
        <EmptyState
          title="You’re all caught up"
          description="New activity will show up here."
        />
      ) : (
        <ul className="space-y-3">
          {data.items.map((notification) => {
            const href = notificationHref(notification);
            return (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!notification.isRead) markRead.mutate(notification.id);
                    if (href) router.push(href);
                  }}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-4 text-left transition",
                    notification.isRead
                      ? "border-border/60 bg-white/50"
                      : "border-primary/25 bg-white shadow-sm",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{notification.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {notification.body}
                      </p>
                      {href ? (
                        <p className="mt-2 text-xs text-primary">Open related item →</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
