"use client";

import { RequestCard } from "@/components/marketplace/request-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequests } from "@/lib/api/hooks";
import { SectionHeader } from "./section-header";

export function FeaturedRequests() {
  const { data, isLoading, isError, refetch } = useRequests({
    status: "OPEN",
    limit: 6,
  });

  return (
    <section
      aria-labelledby="featured-heading"
      className="border-y border-border/60 bg-mist/50 py-10 sm:py-12"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          id="featured-heading"
          title="Open requests"
          description="Live jobs waiting for offers from trusted locals."
          actionHref="/requests"
          actionLabel="View all"
        />

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            description="Open requests failed to load."
            onRetry={() => void refetch()}
          />
        ) : !data?.items.length ? (
          <EmptyState
            title="No open requests"
            description="Be the first to post something neighbors can help with."
            actionLabel="Post a request"
            actionHref="/requests/new"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((request, index) => (
              <div
                key={request.id}
                className="animate-rise"
                style={{ animationDelay: `${Math.min(index, 5) * 0.06}s` }}
              >
                <RequestCard request={request} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
