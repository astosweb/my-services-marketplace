"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Trash2 } from "lucide-react";
import type { ServiceRequestStatus } from "@monorepo/shared";
import { DataPagination } from "@/components/data-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  useDeleteRequest,
  useRequests,
  useUpdateRequest,
} from "@/lib/api/marketplace";

const STATUSES: ServiceRequestStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export function RequestsPageClient() {
  const { search, filters, query, setSearch, setFilter, setPage, setLimit } =
    useListParams<{ status?: string }>({});
  const { data, isLoading, error } = useRequests(query);
  const updateRequest = useUpdateRequest();
  const deleteRequest = useDeleteRequest();

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
          title="Could not load requests"
          description={error instanceof Error ? error.message : "Unknown error"}
        />
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search title or description…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
        <Select
          value={filters.status ?? "all"}
          onValueChange={(value) =>
            setFilter("status", value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No requests" description="Nothing matches these filters." />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Offers</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="max-w-56 truncate font-medium">
                    {request.title}
                    {request.isPremium ? (
                      <Badge variant="secondary" className="ml-2">
                        Premium
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{request.categoryName}</TableCell>
                  <TableCell>{request.city}</TableCell>
                  <TableCell>
                    <Select
                      value={request.status}
                      onValueChange={(status) =>
                        void updateRequest.mutateAsync({
                          id: request.id,
                          status: status as ServiceRequestStatus,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{request.requester.profileName}</TableCell>
                  <TableCell className="tabular-nums">{request.offerCount}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(request.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${request.title}`}
                      disabled={deleteRequest.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete request “${request.title}”? This cannot be undone.`,
                          )
                        ) {
                          void deleteRequest.mutateAsync(request.id);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
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
