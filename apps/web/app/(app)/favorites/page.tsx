"use client";

import { useQueries } from "@tanstack/react-query";
import { RequestCard } from "@/components/marketplace/request-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useFavorites } from "@/hooks/use-favorites";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import type { MarketplaceRequest } from "@monorepo/shared";

export default function FavoritesPage() {
  const { ids, items, isLoading: favoritesLoading } = useFavorites();
  const cachedRequests = items.map((item) => item.request);
  const missingIds = ids.filter(
    (id) => !cachedRequests.some((request) => request.id === id),
  );
  const queries = useQueries({
    queries: missingIds.map((id) => ({
      queryKey: queryKeys.request(id),
      queryFn: () => api.get<MarketplaceRequest>(`/requests/${id}`),
    })),
  });

  const fetchedRequests = queries
    .map((query) => query.data)
    .filter((item): item is MarketplaceRequest => Boolean(item));
  const requests = [...cachedRequests, ...fetchedRequests];
  const isLoading =
    favoritesLoading ||
    (ids.length > 0 && requests.length === 0 && queries.some((q) => q.isLoading));
  const isError =
    !favoritesLoading &&
    ids.length > 0 &&
    requests.length === 0 &&
    queries.some((query) => query.isError);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 max-w-xl">
        <h1 className="font-display text-4xl font-bold tracking-tight">
          Favorites
        </h1>
        <p className="mt-2 text-muted-foreground">
          Requests you saved for later.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: Math.min(Math.max(ids.length, 1), 6) }).map(
            (_, index) => (
              <Skeleton key={index} className="h-40 rounded-2xl" />
            ),
          )}
        </div>
      ) : ids.length === 0 ? (
        <EmptyState
          title="No favorites yet"
          description="Tap the heart on a request to save it here."
          actionLabel="Browse requests"
          actionHref="/requests"
        />
      ) : isError ? (
        <ErrorState description="Couldn’t load saved requests." />
      ) : requests.length === 0 ? (
        <EmptyState
          title="Saved requests unavailable"
          description="Those listings may have been removed."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}
