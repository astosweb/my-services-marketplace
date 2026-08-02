"use client";

import { formatDistanceToNow } from "date-fns";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/api/notifications";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

export function NotificationCenter() {
  const { permissions } = useSession();
  const canRead = permissions.includes(PERMISSIONS.NOTIFICATIONS_READ);

  const { data, isLoading } = useNotifications({ limit: 10 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  if (!canRead) {
    return null;
  }

  const items = data?.items ?? [];
  const unreadCount = data?.meta.unreadCount ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative cursor-pointer"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 size-4 justify-center p-0 text-[10px]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-88 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 cursor-pointer text-xs"
              disabled={markAll.isPending}
              onClick={() => void markAll.mutateAsync().catch(() => null)}
            >
              <CheckCheck className="mr-1 size-3.5" />
              Mark all read
            </Button>
          ) : null}
        </div>
        <Separator />
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : items.length > 0 ? (
          <ScrollArea className="max-h-80">
            <ul className="divide-y">
              {items.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className="hover:bg-muted/50 flex w-full items-start gap-3 px-4 py-3 text-left"
                    disabled={notification.isRead || markRead.isPending}
                    onClick={() =>
                      void markRead.mutateAsync(notification.id).catch(() => null)
                    }
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        notification.isRead
                          ? "bg-muted-foreground/30"
                          : "bg-blue-500",
                      )}
                    />
                    <span className="min-w-0 space-y-0.5">
                      <span
                        className={cn(
                          "block truncate text-sm",
                          notification.isRead ? "font-normal" : "font-medium",
                        )}
                      >
                        {notification.title}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {notification.body}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : (
          <EmptyState
            icon={BellOff}
            title="You're all caught up"
            className="border-0"
          />
        )}
        <Separator />
        <div className="p-2">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/settings/notifications">Notification settings</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
