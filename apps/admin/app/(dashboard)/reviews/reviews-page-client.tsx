"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Trash2 } from "lucide-react";
import { DataPagination } from "@/components/data-pagination";
import { Button } from "@/components/ui/button";
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
import { useDeleteReview, useReviews } from "@/lib/api/marketplace";

export function ReviewsPageClient() {
  const { search, query, setSearch, setPage, setLimit } = useListParams({});
  const { data, isLoading, error } = useReviews(query);
  const deleteReview = useDeleteReview();

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
          title="Could not load reviews"
          description={error instanceof Error ? error.message : "Unknown error"}
        />
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Input
        placeholder="Search review body…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="max-w-sm"
      />

      {items.length === 0 ? (
        <EmptyState title="No reviews" description="Nothing matches this search." />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rating</TableHead>
                <TableHead>Body</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((review) => (
                <TableRow key={review.id}>
                  <TableCell className="tabular-nums">{review.rating}/5</TableCell>
                  <TableCell className="max-w-64 truncate">
                    {review.body ?? "—"}
                  </TableCell>
                  <TableCell>{review.author.profileName}</TableCell>
                  <TableCell>{review.subject?.profileName ?? "—"}</TableCell>
                  <TableCell className="max-w-40 truncate">
                    {review.request?.title ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(review.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete review"
                      onClick={() => {
                        if (window.confirm("Delete this review and recompute rating?")) {
                          void deleteReview.mutateAsync(review.id);
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
