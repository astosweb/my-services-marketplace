"use client";

import Link from "next/link";
import {
  CITY_LABELS,
  ESTONIAN_CITIES,
  type EstonianCity,
} from "@monorepo/shared";
import { ArrowUpRight, MapPin } from "lucide-react";
import { SearchBar } from "@/components/marketplace/search-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/lib/api/hooks";

export function HomeToolbar() {
  const { data: categories, isLoading } = useCategories();

  return (
    <section
      aria-labelledby="home-heading"
      className="border-b border-border/70 bg-white/70 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="animate-rise flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2
              id="home-heading"
              className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]"
            >
              Find local help nearby
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search open jobs across Tallinn, Tartu, Pärnu &amp; Narva.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="accent" size="sm">
              <Link href="/requests/new">Post a request</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/explore">
                Explore
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>

        <div className="animate-rise delay-1 mt-4">
          {isLoading ? (
            <Skeleton className="h-12 w-full rounded-xl" />
          ) : (
            <SearchBar
              categories={categories ?? []}
              compact
              className="border border-border/80 shadow-sm shadow-primary/5"
            />
          )}
        </div>

        <nav
          aria-label="Cities"
          className="animate-rise delay-2 mt-3 flex flex-wrap items-center gap-1.5"
        >
          <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden />
            City
          </span>
          {ESTONIAN_CITIES.map((city) => (
            <Link
              key={city}
              href={`/search?city=${city}`}
              className="rounded-md bg-secondary/80 px-2 py-1 text-xs font-medium text-secondary-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {CITY_LABELS[city as EstonianCity]}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
