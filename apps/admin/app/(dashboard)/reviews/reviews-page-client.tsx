"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Star, Trash2 } from "lucide-react";

import { DataPagination } from "@/components/data-pagination";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
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

  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    await deleteReview.mutateAsync(deleteTargetId);
    setDeleteTargetId(null);
  };

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
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reviews & Ratings"
        description="Moderate customer reviews and feedback submitted for completed services."
      />

      <div className="flex flex-col gap-3 px-4 lg:px-6 sm:flex-row sm:items-center">
        <Input
          placeholder="Search review body…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
      </div>

      {items.length === 0 ? (
        <div className="px-4 lg:px-6">
          <EmptyState
            icon={Star}
            title="No reviews found"
            description="Nothing matches your current search criteria."
          />
        </div>
      ) : (
        <div className="px-4 lg:px-6">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rating</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-semibold text-amber-500 tabular-nums">
                      {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                      <span className="ml-1 text-xs text-muted-foreground">({review.rating})</span>
                    </TableCell>
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
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete review"
                        onClick={() => setDeleteTargetId(review.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
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

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete Review"
        description="Are you sure you want to delete this review? User ratings will be automatically recomputed."
        confirmText="Delete Review"
        isLoading={deleteReview.isPending}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
