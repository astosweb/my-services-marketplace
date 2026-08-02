"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { DataPagination } from "@/components/data-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
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
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Input
        placeholder="Search by request title…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="max-w-sm"
      />

      {items.length === 0 ? (
        <EmptyState title="No conversations" description="Inbox is empty." />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Participants</TableHead>
                <TableHead>Last message</TableHead>
                <TableHead>Updated</TableHead>
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
                    {conversation.participants
                      .map((participant) => participant.profileName)
                      .join(", ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-64 truncate text-sm">
                    {conversation.lastMessage?.body || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(conversation.updatedAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data?.meta ? (
        <DataPagination
          pagination={data.meta}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      ) : null}
    </div>
  );
}
