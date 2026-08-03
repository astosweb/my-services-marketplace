"use client";

import Link from "next/link";
import { Heart, MapPin } from "lucide-react";
import type { MarketplaceRequest } from "@monorepo/shared";
import { CITY_LABELS, type EstonianCity } from "@monorepo/shared";
import { Badge } from "@/components/ui/badge";
import { useFavoriteHydrated } from "@/hooks/use-favorites";
import { categoryIcon } from "@/lib/site";
import { cn, formatBudget, formatRelativeTime } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-emerald-100 text-emerald-800",
  PENDING_REVIEW: "bg-amber-100 text-amber-900",
  IN_PROGRESS: "bg-sky-100 text-sky-900",
  COMPLETED: "bg-secondary text-secondary-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
};

function cityLabel(city: string) {
  return CITY_LABELS[city as EstonianCity] ?? city;
}

export function RequestCard({ request }: { request: MarketplaceRequest }) {
  const favorites = useFavoriteHydrated();
  const Icon = categoryIcon(request.categoryId);
  const isFavorite = favorites.ready && favorites.has(request.id);

  return (
    <article className="group relative flex flex-col gap-3 rounded-2xl border border-border/80 bg-white/80 p-4 transition hover:border-primary/30 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground">
              {request.categoryName}
            </p>
            <Link
              href={`/requests/${request.id}`}
              className="block truncate font-display text-base font-semibold text-foreground transition group-hover:text-primary"
            >
              {request.title}
            </Link>
          </div>
        </div>
        <button
          type="button"
          aria-label={isFavorite ? "Remove favorite" : "Save favorite"}
          onClick={(event) => {
            event.preventDefault();
            favorites.toggle(request.id);
          }}
          className="rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-primary"
        >
          <Heart
            className={cn("size-4", isFavorite && "fill-primary text-primary")}
          />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" />
          {cityLabel(request.city)}
        </span>
        <span aria-hidden>·</span>
        <span>{formatRelativeTime(request.createdAt)}</span>
        {request.isPremium ? (
          <Badge className="bg-accent/90 text-accent-foreground">Premium</Badge>
        ) : null}
        <Badge className={cn(STATUS_STYLES[request.status] ?? "")}>
          {request.status.replaceAll("_", " ")}
        </Badge>
      </div>

      <p className="mt-auto text-sm font-semibold text-primary">
        {formatBudget(request.budgetCents, request.budget)}
      </p>
    </article>
  );
}

export function statusBadgeClass(status: string) {
  return STATUS_STYLES[status] ?? "bg-secondary text-secondary-foreground";
}
