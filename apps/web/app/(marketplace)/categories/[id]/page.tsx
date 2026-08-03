"use client";

import { use } from "react";
import { RequestCard } from "@/components/marketplace/request-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, useRequests } from "@/lib/api/hooks";
import { CategoryIcon } from "@/lib/site";

export default function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const categoriesQuery = useCategories();
  const requestsQuery = useRequests({ categoryId: id, limit: 50 });
  const category = categoriesQuery.data?.find((item) => item.id === id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-start gap-4">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
          <CategoryIcon categoryId={id} className="size-6" />
        </span>
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            {category?.name ?? (categoriesQuery.isLoading ? "…" : "Category")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Open requests in this category across Estonia.
          </p>
        </div>
      </div>

      {requestsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : requestsQuery.isError ? (
        <ErrorState
          description="Couldn’t load category requests."
          onRetry={() => void requestsQuery.refetch()}
        />
      ) : !requestsQuery.data?.items.length ? (
        <EmptyState
          title="No requests here yet"
          description="Be the first to post in this category."
          actionLabel="Post a request"
          actionHref="/requests/new"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requestsQuery.data.items.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}
