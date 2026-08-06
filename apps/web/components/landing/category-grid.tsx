"use client";

import Link from "next/link";
import { CategoryTile } from "@/components/marketplace/category-tile";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/lib/api/hooks";
import { SectionHeader } from "./section-header";

export function CategoryGrid() {
  const { data, isLoading, isError, refetch } = useCategories();

  return (
    <section
      aria-labelledby="categories-heading"
      className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12"
    >
      <SectionHeader
        id="categories-heading"
        title="Browse by category"
        description="Plumbing, cleaning, handyman, and more — jump straight to what you need."
        actionHref="/categories"
        actionLabel="All categories"
        actionVariant="ghost"
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
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
        <>
          <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
            {data.slice(0, 10).map((category, index) => (
              <div
                key={category.id}
                className="animate-scale-in w-[9.5rem] shrink-0 sm:w-auto"
                style={{ animationDelay: `${Math.min(index, 6) * 0.05}s` }}
              >
                <CategoryTile category={category} compact />
              </div>
            ))}
          </div>
          {data.length > 10 ? (
            <p className="mt-4 text-center text-sm text-muted-foreground sm:text-left">
              <Link
                href="/categories"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                View {data.length - 10} more categories
              </Link>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
