"use client";

import Link from "next/link";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversations } from "@/lib/api/hooks";
import { formatRelativeTime, initials } from "@/lib/utils";

export default function MessagesInboxPage() {
  const { data, isLoading, isError, refetch } = useConversations();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight">
          Messages
        </h1>
        <p className="mt-2 text-muted-foreground">
          Conversations about your requests and offers.
        </p>
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
          title="No conversations yet"
          description="Message threads appear when you open a chat on a request."
          actionLabel="Browse requests"
          actionHref="/requests"
        />
      ) : (
        <ul className="space-y-2">
          {data.items.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/messages/${conversation.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-white/70 p-4 transition hover:border-primary/30 hover:bg-white"
              >
                {conversation.participant.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={conversation.participant.avatarUrl}
                    alt=""
                    className="size-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex size-12 items-center justify-center rounded-full bg-secondary font-display text-sm font-semibold text-primary">
                    {initials(conversation.participant.profileName)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-display font-semibold">
                      {conversation.participant.profileName}
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
                  <p className="mt-0.5 truncate text-sm">
                    {conversation.lastMessage?.body ?? "No messages yet"}
                  </p>
                </div>
                {conversation.unreadCount > 0 ? (
                  <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                    {conversation.unreadCount}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
