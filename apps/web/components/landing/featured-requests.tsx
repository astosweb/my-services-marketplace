"use client";

import Link from "next/link";
import { RequestCard } from "@/components/marketplace/request-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequests } from "@/lib/api/hooks";

export function FeaturedRequests() {
  const { data, isLoading, isError, refetch } = useRequests({
    status: "OPEN",
    limit: 6,
  });

  return (
    <section className="bg-mist/60 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-bold tracking-tight">
              Featured open requests
            </h2>
            <p className="mt-2 text-muted-foreground">
              Live jobs waiting for offers from trusted locals.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/requests">View all</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            description="Featured requests failed to load."
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
