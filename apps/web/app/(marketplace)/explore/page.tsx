"use client";

import { useMemo, useState } from "react";
import {
  CITY_LABELS,
  ESTONIAN_CITIES,
  type EstonianCity,
} from "@monorepo/shared";
import { CategoryTile } from "@/components/marketplace/category-tile";
import { RequestCard } from "@/components/marketplace/request-card";
import { SearchBar } from "@/components/marketplace/search-bar";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, useRequests } from "@/lib/api/hooks";

export default function ExplorePage() {
  const [city, setCity] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const categoriesQuery = useCategories();
  const requestsQuery = useRequests({
    city: city || undefined,
    categoryId: categoryId || undefined,
    status: "OPEN",
    limit: 24,
  });

  const categories = categoriesQuery.data ?? [];
  const title = useMemo(() => {
    const parts = ["Explore"];
    if (city) parts.push(CITY_LABELS[city as EstonianCity] ?? city);
    return parts.join(" · ");
  }, [city]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">
          Filter open jobs by city and category, or search by keyword.
        </p>
      </div>

      <SearchBar
        key={`${city}-${categoryId}`}
        categories={categories}
        defaultCity={city}
        defaultCategoryId={categoryId}
        className="mb-8"
        compact
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip
          active={!city}
          label="All cities"
          onClick={() => setCity("")}
        />
        {ESTONIAN_CITIES.map((value) => (
          <FilterChip
            key={value}
            active={city === value}
            label={CITY_LABELS[value]}
            onClick={() => setCity(value)}
          />
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip
          active={!categoryId}
          label="All categories"
          onClick={() => setCategoryId("")}
        />
        {categories.map((category) => (
          <FilterChip
            key={category.id}
            active={categoryId === category.id}
            label={category.name}
            onClick={() =>
              setCategoryId((current) =>
                current === category.id ? "" : category.id,
              )
            }
          />
        ))}
      </div>

      <div className="mb-10">
        <h2 className="mb-4 font-display text-xl font-semibold">Categories</h2>
        {categoriesQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : categoriesQuery.isError ? (
          <ErrorState
            description="Categories failed to load."
            onRetry={() => void categoriesQuery.refetch()}
          />
        ) : categories.length === 0 ? (
          <EmptyState title="No categories" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {categories.slice(0, 8).map((category) => (
              <CategoryTile key={category.id} category={category} />
            ))}
          </div>
        )}
      </div>

      <h2 className="mb-4 font-display text-xl font-semibold">Open requests</h2>
      {requestsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : requestsQuery.isError ? (
        <ErrorState
          description="Requests failed to load."
          onRetry={() => void requestsQuery.refetch()}
        />
      ) : !requestsQuery.data?.items.length ? (
        <EmptyState
          title="No matching requests"
          description="Try another city or category."
          actionLabel="Post a request"
          actionHref="/requests/new"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requestsQuery.data.items.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          : "rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
      }
    >
      {label}
    </button>
  );
}
