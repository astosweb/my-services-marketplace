"use client";

import { useMemo } from "react";
import { ProviderCard } from "@/components/marketplace/provider-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequests } from "@/lib/api/hooks";
import type { PublicUser } from "@monorepo/shared";

export function PopularProviders() {
  const { data, isLoading, isError, refetch } = useRequests({
    status: "OPEN",
    limit: 24,
  });

  const providers = useMemo(() => {
    const map = new Map<string, PublicUser>();
    for (const request of data?.items ?? []) {
      const user = request.requester;
      if (!user?.id) continue;
      const existing = map.get(user.id);
      if (!existing || user.rating > existing.rating) {
        map.set(user.id, user);
      }
    }
    return [...map.values()]
      .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
      .slice(0, 6);
  }, [data]);

  return (
    <section className="bg-primary py-16 text-primary-foreground">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-8 max-w-xl">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Active neighbors
          </h2>
          <p className="mt-2 text-primary-foreground/75">
            People posting and completing work across Estonia right now.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            description="Couldn’t load active neighbors."
            onRetry={() => void refetch()}
          />
        ) : providers.length === 0 ? (
          <EmptyState
            title="No profiles to show"
            description="Active requesters will appear here."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((user) => (
              <div key={user.id} className="[&_a]:bg-white/95 [&_a]:text-foreground">
                <ProviderCard user={user} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
