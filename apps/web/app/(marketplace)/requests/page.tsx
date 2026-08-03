"use client";

import { useState } from "react";
import {
  CITY_LABELS,
  ESTONIAN_CITIES,
  type EstonianCity,
} from "@monorepo/shared";
import { RequestCard } from "@/components/marketplace/request-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, useRequests } from "@/lib/api/hooks";

export default function RequestsPage() {
  const [city, setCity] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const categoriesQuery = useCategories();
  const requestsQuery = useRequests({
    city: city || undefined,
    categoryId: categoryId || undefined,
    status: "OPEN",
    limit: 50,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 max-w-xl">
        <h1 className="font-display text-4xl font-bold tracking-tight">
          Open requests
        </h1>
        <p className="mt-2 text-muted-foreground">
          Browse live jobs and send an offer when you can help.
        </p>
      </div>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <select
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
          aria-label="Filter by city"
        >
          <option value="">All cities</option>
          {ESTONIAN_CITIES.map((value) => (
            <option key={value} value={value}>
              {CITY_LABELS[value as EstonianCity]}
            </option>
          ))}
        </select>
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {(categoriesQuery.data ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

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
          title="No open requests"
          description="Try another filter or post the first one."
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
