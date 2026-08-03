"use client";

import { CategoryTile } from "@/components/marketplace/category-tile";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/lib/api/hooks";

export function CategoryGrid() {
  const { data, isLoading, isError, refetch } = useCategories();

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-8 max-w-xl">
        <h2 className="font-display text-3xl font-bold tracking-tight">
          Browse by category
        </h2>
        <p className="mt-2 text-muted-foreground">
          From plumbing to pet care — find the right help for your home and day.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          description="We couldn’t load categories."
          onRetry={() => void refetch()}
        />
      ) : !data?.length ? (
        <EmptyState
          title="No categories yet"
          description="Check back soon for service categories."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {data.map((category) => (
            <CategoryTile key={category.id} category={category} />
          ))}
        </div>
      )}
    </section>
  );
}
