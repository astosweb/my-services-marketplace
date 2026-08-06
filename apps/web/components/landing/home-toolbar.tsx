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
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export function HomeToolbar() {
  const { data: categories, isLoading } = useCategories();

  return (
    <section
      aria-labelledby="home-heading"
      className="border-b border-border/70 bg-white/55 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
        <div className="animate-rise flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="min-w-0 max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              {SITE_NAME} · Estonia
            </p>
            <h1
              id="home-heading"
              className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            >
              Find local help nearby
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {SITE_TAGLINE}. Search open jobs or post a request in Tallinn,
              Tartu, Pärnu, or Narva.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="accent">
              <Link href="/requests/new">Post a request</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/explore">
                Explore
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>

        <div className="animate-rise delay-1 mt-6">
          {isLoading ? (
            <Skeleton className="h-[3.25rem] w-full rounded-2xl" />
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
          className="animate-rise delay-2 mt-4 flex flex-wrap items-center gap-2"
        >
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden />
            Quick city
          </span>
          {ESTONIAN_CITIES.map((city) => (
            <Link
              key={city}
              href={`/search?city=${city}`}
              className="rounded-lg bg-secondary/80 px-2.5 py-1 text-xs font-medium text-secondary-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {CITY_LABELS[city as EstonianCity]}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
