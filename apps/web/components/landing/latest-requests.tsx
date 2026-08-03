"use client";

import Link from "next/link";
import { RequestCard } from "@/components/marketplace/request-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequests } from "@/lib/api/hooks";

export function LatestRequests() {
  const { data, isLoading, isError, refetch } = useRequests({ limit: 6 });

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Latest on Bidy
          </h2>
          <p className="mt-2 text-muted-foreground">
            Fresh posts from neighbors who need a hand.
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href="/explore">Explore marketplace</Link>
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
          description="Latest requests failed to load."
          onRetry={() => void refetch()}
        />
      ) : !data?.items.length ? (
        <EmptyState
          title="Nothing new yet"
          description="New requests will show up here as people post."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </section>
  );
}
