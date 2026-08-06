"use client";

import { useMemo } from "react";
import { ProviderCard } from "@/components/marketplace/provider-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequests } from "@/lib/api/hooks";
import type { PublicUser } from "@monorepo/shared";
import { SectionHeader } from "./section-header";

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
    <section
      aria-labelledby="neighbors-heading"
      className="border-y border-border/60 bg-primary py-10 text-primary-foreground sm:py-12"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          id="neighbors-heading"
          title="Active neighbors"
          description="People posting and completing work across Estonia right now."
          tone="inverted"
          actionHref="/explore"
          actionLabel="Browse jobs"
        />

        {isLoading ? (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl bg-white/10" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl bg-white text-foreground">
            <ErrorState
              description="Couldn’t load active neighbors."
              onRetry={() => void refetch()}
            />
          </div>
        ) : providers.length === 0 ? (
          <div className="rounded-xl bg-white text-foreground">
            <EmptyState
              title="No profiles to show"
              description="Active requesters will appear here."
            />
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((user) => (
              <div
                key={user.id}
                className="[&_a]:border-transparent [&_a]:bg-white/95 [&_a]:text-foreground [&_a]:shadow-none"
              >
                <ProviderCard user={user} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
