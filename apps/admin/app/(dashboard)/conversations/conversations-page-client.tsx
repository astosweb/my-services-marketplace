"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Eye, MessageSquare, MessagesSquare, User } from "lucide-react";

import { DataPagination } from "@/components/data-pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useListParams } from "@/hooks/use-list-params";
import { useConversationMessages, useConversations } from "@/lib/api/marketplace";

export function ConversationsPageClient() {
  const { search, query, setSearch, setPage, setLimit } = useListParams({});
  const { data, isLoading, error } = useConversations(query);

  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);

  const {
    data: detail,
    isLoading: isDetailLoading,
    error: detailError,
  } = useConversationMessages(activeConversationId);

  if (isLoading) {
    return (
      <div className="px-4 lg:px-6">
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 lg:px-6">
        <EmptyState
          icon={AlertTriangle}
          title="Could not load conversations"
          description={error instanceof Error ? error.message : "Unknown error"}
        />
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Conversations"
        description="Request-scoped messaging for moderation"
      />

      <div className="flex flex-col gap-3 px-4 lg:px-6 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by request title…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
      </div>

      {items.length === 0 ? (
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={MessagesSquare}
            title="No conversations found"
            description="Inbox is empty."
          />
        </div>
      ) : (
        <div className="px-4 lg:px-6">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Last Message</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-24 text-right">Inspect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((conversation) => (
                  <TableRow
                    key={conversation.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setActiveConversationId(conversation.id)}
                  >
                    <TableCell className="max-w-56 truncate font-medium">
                      {conversation.requestTitle}
                    </TableCell>
                    <TableCell>{conversation.categoryName}</TableCell>
                    <TableCell className="max-w-48 truncate">
                      <div className="flex flex-wrap gap-1">
                        {conversation.participants.map((p) => (
                          <Badge key={p.id} variant="outline" className="text-xs">
                            {p.profileName}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-64 truncate text-sm">
                      {conversation.lastMessage?.body || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(conversation.updatedAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Inspect conversation"
                        onClick={() => setActiveConversationId(conversation.id)}
                      >
                        <Eye className="size-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {data?.meta ? (
        <div className="px-4 lg:px-6">
          <DataPagination
            pagination={data.meta}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </div>
      ) : null}

      {/* Full Conversation Message Thread Modal */}
      <Dialog
        open={Boolean(activeConversationId)}
        onOpenChange={(open) => !open && setActiveConversationId(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-xl flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" />
                Conversation History
              </DialogTitle>
              {detail ? <StatusBadge status={detail.requestStatus} /> : null}
            </div>
            <DialogDescription>
              Request: <span className="font-semibold text-foreground">{detail?.requestTitle ?? "Loading..."}</span>
            </DialogDescription>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="space-y-4 py-6">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-12 w-2/3 ml-auto" />
              <Skeleton className="h-12 w-1/2" />
            </div>
          ) : detailError ? (
            <div className="py-6 text-center text-sm text-destructive">
              Could not load full message thread.
            </div>
          ) : detail ? (
            <div className="flex flex-col gap-4 flex-1 overflow-hidden pt-2">
              {/* Participants Bar */}
              <div className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-lg border text-xs">
                <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                  Participants:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {detail.participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-1 bg-background px-2 py-0.5 rounded-md border">
                      <Avatar className="size-4">
                        <AvatarImage src={p.avatarUrl || undefined} />
                        <AvatarFallback><User className="size-3" /></AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{p.profileName}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat Thread Messages */}
              <ScrollArea className="flex-1 pr-4 h-[350px]">
                <div className="flex flex-col gap-3 py-2">
                  {detail.messages.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">
                      No messages exchanged in this conversation thread yet.
                    </p>
                  ) : (
                    detail.messages.map((message, index) => {
                      const isFirstParticipant =
                        message.senderId === detail.participants[0]?.id;
                      return (
                        <div
                          key={message.id || index}
                          className={`flex items-start gap-2.5 max-w-[85%] ${
                            isFirstParticipant ? "self-start" : "self-end flex-row-reverse"
                          }`}
                        >
                          <Avatar className="size-8 shrink-0 mt-0.5">
                            <AvatarImage src={message.senderAvatar || undefined} />
                            <AvatarFallback className="text-xs">
                              {message.senderName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`flex flex-col gap-1 p-3 rounded-2xl text-sm ${
                              isFirstParticipant
                                ? "bg-muted text-foreground rounded-tl-xs"
                                : "bg-primary text-primary-foreground rounded-tr-xs"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 text-[11px] opacity-80 font-medium">
                              <span>{message.senderName}</span>
                              <span>
                                {formatDistanceToNow(new Date(message.createdAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                            {message.body ? (
                              <p className="whitespace-pre-wrap leading-relaxed">{message.body}</p>
                            ) : null}
                            {message.attachmentUrl || message.attachmentKey ? (
                              <div className="mt-1.5 p-2 rounded-lg bg-black/10 dark:bg-white/10 text-xs font-mono">
                                📎 Attachment: {message.attachmentKey || message.attachmentUrl}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
