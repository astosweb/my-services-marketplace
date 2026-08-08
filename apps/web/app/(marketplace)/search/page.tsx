"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RequestCard } from "@/components/marketplace/request-card";
import { SearchBar } from "@/components/marketplace/search-bar";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, useRequests } from "@/lib/api/hooks";

function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const city = searchParams.get("city") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";

  const categoriesQuery = useCategories();
  const requestsQuery = useRequests({
    city: city || undefined,
    categoryId: categoryId || undefined,
    q: q.trim() || undefined,
    limit: 50,
  });

  const items = requestsQuery.data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-display text-4xl font-bold tracking-tight">Search</h1>
        <p className="mt-2 text-muted-foreground">
          {q
            ? `Results for “${q}”`
            : "Filter by city and category, or type keywords."}
        </p>
      </div>

      <SearchBar
        categories={categoriesQuery.data ?? []}
        defaultQuery={q}
        defaultCity={city}
        defaultCategoryId={categoryId}
        className="mb-8"
        compact
      />

      {requestsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : requestsQuery.isError ? (
        <ErrorState
          description="Search failed to load."
          onRetry={() => void requestsQuery.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No matches"
          description="Try different keywords or clear a filter."
          actionLabel="Browse requests"
          actionHref="/requests"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <Skeleton className="mb-8 h-12 w-48" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
