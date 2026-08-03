"use client";

import { CategoryTile } from "@/components/marketplace/category-tile";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/lib/api/hooks";

export default function CategoriesPage() {
  const { data, isLoading, isError, refetch } = useCategories();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 max-w-xl">
        <h1 className="font-display text-4xl font-bold tracking-tight">
          Categories
        </h1>
        <p className="mt-2 text-muted-foreground">
          Every kind of local help Bidy covers.
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
          description="Categories failed to load."
          onRetry={() => void refetch()}
        />
      ) : !data?.length ? (
        <EmptyState title="No categories yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {data.map((category) => (
            <CategoryTile key={category.id} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}
