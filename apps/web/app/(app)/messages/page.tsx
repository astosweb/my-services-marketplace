"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, Pin, PinOff } from "lucide-react";
import type { InboxConversation } from "@monorepo/shared";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api/client";
import { useConversations } from "@/lib/api/hooks";
import { cn, formatRelativeTime, initials } from "@/lib/utils";
import { toast } from "sonner";

export default function MessagesInboxPage() {
  const [showArchived, setShowArchived] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useConversations(showArchived);

  const archiveMutation = useMutation({
    mutationFn: ({
      id,
      isArchived,
    }: {
      id: string;
      isArchived: boolean;
    }) => api.patch(`/conversations/${id}/archive`, { isArchived }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : "Could not update archive",
      ),
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned: boolean }) =>
      api.patch(`/conversations/${id}/pin`, { isPinned }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : "Could not update pin",
      ),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Messages
          </h1>
          <p className="mt-2 text-muted-foreground">
            Conversations about your requests and offers.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowArchived((value) => !value)}
        >
          {showArchived ? "Inbox" : "Archived"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          description="Inbox failed to load."
          onRetry={() => void refetch()}
        />
      ) : !data?.items.length ? (
        <EmptyState
          title={showArchived ? "No archived messages" : "No conversations yet"}
          description={
            showArchived
              ? "Archived conversations appear here."
              : "Message threads appear when you chat with someone on a request."
          }
          actionLabel={showArchived ? undefined : "Browse requests"}
          actionHref={showArchived ? undefined : "/requests"}
        />
      ) : (
        <ul className="space-y-2">
          {data.items.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              showArchived={showArchived}
              busy={archiveMutation.isPending || pinMutation.isPending}
              onArchive={() =>
                archiveMutation.mutate({
                  id: conversation.id,
                  isArchived: !showArchived,
                })
              }
              onPin={() =>
                pinMutation.mutate({
                  id: conversation.id,
                  isPinned: !conversation.isPinned,
                })
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ConversationRow({
  conversation,
  showArchived,
  busy,
  onArchive,
  onPin,
}: {
  conversation: InboxConversation;
  showArchived: boolean;
  busy: boolean;
  onArchive: () => void;
  onPin: () => void;
}) {
  return (
    <li className="group relative flex items-stretch gap-1 rounded-2xl border border-border/70 bg-white/70 transition hover:border-primary/30 hover:bg-white">
      <Link
        href={`/messages/${conversation.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 p-4"
      >
        {conversation.participant.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={conversation.participant.avatarUrl}
            alt=""
            className="size-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm font-semibold text-primary">
            {initials(conversation.participant.profileName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1.5 truncate font-display font-semibold">
              {conversation.isPinned ? (
                <Pin
                  className="size-3.5 shrink-0 fill-current text-muted-foreground"
                  aria-label="Pinned"
                />
              ) : null}
              <span className="truncate">
                {conversation.participant.profileName}
              </span>
            </p>
            {conversation.lastMessage ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(conversation.lastMessage.createdAt)}
              </span>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {conversation.requestTitle}
          </p>
          <p
            className={cn(
              "mt-0.5 truncate text-sm",
              conversation.unreadCount > 0 && "font-semibold text-foreground",
            )}
          >
            {conversation.lastMessage?.body ?? "No messages yet"}
          </p>
        </div>
        {conversation.unreadCount > 0 ? (
          <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
            {conversation.unreadCount}
          </span>
        ) : null}
      </Link>
      <div className="flex shrink-0 flex-col justify-center gap-1 py-2 pr-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={busy}
          aria-label={conversation.isPinned ? "Unpin" : "Pin"}
          onClick={onPin}
        >
          {conversation.isPinned ? (
            <PinOff className="size-4" />
          ) : (
            <Pin className="size-4" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={busy}
          aria-label={showArchived ? "Unarchive" : "Archive"}
          onClick={onArchive}
        >
          <Archive className="size-4" />
        </Button>
      </div>
    </li>
  );
}
