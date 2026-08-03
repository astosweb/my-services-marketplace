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
  const { ids } = useFavorites();
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.request(id),
      queryFn: () => api.get<MarketplaceRequest>(`/requests/${id}`),
    })),
  });

  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);
  const requests = queries
    .map((query) => query.data)
    .filter((item): item is MarketplaceRequest => Boolean(item));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 max-w-xl">
        <h1 className="font-display text-4xl font-bold tracking-tight">
          Favorites
        </h1>
        <p className="mt-2 text-muted-foreground">
          Requests you saved on this device.
        </p>
      </div>

      {ids.length === 0 ? (
        <EmptyState
          title="No favorites yet"
          description="Tap the heart on a request to save it here."
          actionLabel="Browse requests"
          actionHref="/requests"
        />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: Math.min(ids.length, 6) }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : isError && requests.length === 0 ? (
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
