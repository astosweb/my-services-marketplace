"use client";

import { RequestCard } from "@/components/marketplace/request-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequests } from "@/lib/api/hooks";
import { SectionHeader } from "./section-header";

export function LatestRequests() {
  const { data, isLoading, isError, refetch } = useRequests({ limit: 6 });

  return (
    <section
      aria-labelledby="latest-heading"
      className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12"
    >
      <SectionHeader
        id="latest-heading"
        title="Latest on Gobid"
        description="Fresh posts from neighbors who need a hand."
        actionHref="/explore"
        actionLabel="Explore marketplace"
        actionVariant="ghost"
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          description="Latest requests failed to load."
          onRetry={() => void refetch()}
        />
      ) : !data?.items.length ? (
        <EmptyState
          title="Nothing new yet"
          description="New requests will show up here as people post."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </section>
  );
}
