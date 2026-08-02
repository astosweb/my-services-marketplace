"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Eye, MessagesSquare } from "lucide-react";
import type { ConversationDto } from "@monorepo/shared";

import { DataPagination } from "@/components/data-pagination";
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
import { useConversations } from "@/lib/api/marketplace";

export function ConversationsPageClient() {
  const { search, query, setSearch, setPage, setLimit } = useListParams({});
  const { data, isLoading, error } = useConversations(query);

  const [activeConversation, setActiveConversation] =
    React.useState<ConversationDto | null>(null);

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
        title="Moderation & Conversations"
        description="Monitor user communications, negotiate service terms, and inspect message threads."
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
                  <TableRow key={conversation.id}>
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
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Inspect conversation"
                        onClick={() => setActiveConversation(conversation)}
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

      {/* Conversation Thread Inspection Modal */}
      <Dialog
        open={Boolean(activeConversation)}
        onOpenChange={(open) => !open && setActiveConversation(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Conversation Details</DialogTitle>
            <DialogDescription>
              Request: {activeConversation?.requestTitle}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Participants
              </h4>
              <div className="flex flex-wrap gap-2">
                {activeConversation?.participants.map((p) => (
                  <Badge key={p.id} variant="secondary">
                    {p.profileName}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Recent Message Preview
              </h4>
              <ScrollArea className="h-40 rounded-md border p-3 bg-muted/30">
                {activeConversation?.lastMessage ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">
                      Sender ID: {activeConversation.lastMessage.senderId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activeConversation.lastMessage.body}
                    </p>
                    <p className="text-[10px] text-muted-foreground pt-1">
                      {new Date(activeConversation.lastMessage.createdAt).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
