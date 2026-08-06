"use client";

import Link from "next/link";
import { Eye, Heart, Inbox, MapPin, Sparkles } from "lucide-react";
import type { MarketplaceRequest } from "@monorepo/shared";
import { CITY_LABELS, type EstonianCity } from "@monorepo/shared";
import { Badge } from "@/components/ui/badge";
import { useFavorites } from "@/hooks/use-favorites";
import { CategoryIcon } from "@/lib/site";
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
  const favorites = useFavorites();
  const isFavorite = favorites.has(request.id);
  const cover = request.photos[0];
  const showStatus = request.status !== "OPEN";

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border bg-white/85 transition duration-200 hover:shadow-sm",
        request.isPremium
          ? "border-accent/45 hover:border-accent/70"
          : "border-border/80 hover:border-primary/35",
      )}
    >
      <Link
        href={`/requests/${request.id}`}
        className="flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-secondary">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.url}
              alt=""
              className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-primary/70">
              <CategoryIcon categoryId={request.categoryId} className="size-8" />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
            <span className="inline-flex max-w-[70%] items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[11px] font-semibold text-primary backdrop-blur-sm">
              <CategoryIcon categoryId={request.categoryId} className="size-3 shrink-0" />
              <span className="truncate">{request.categoryName}</span>
            </span>
            {request.isPremium ? (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-1 text-accent backdrop-blur-sm"
                aria-label="Boosted"
              >
                <Sparkles className="size-3.5" />
              </span>
            ) : null}
          </div>

          {showStatus ? (
            <Badge
              className={cn(
                "absolute left-2 top-2",
                STATUS_STYLES[request.status] ?? "",
              )}
            >
              {request.status.replaceAll("_", " ")}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3.5">
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold text-foreground transition group-hover:text-primary">
              {request.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {request.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5 shrink-0" />
              {cityLabel(request.city)}
            </span>
            <span aria-hidden>·</span>
            <span>{formatRelativeTime(request.createdAt)}</span>
          </div>

          <div className="mt-auto flex items-center gap-3 pt-1">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">
              {formatBudget(request.budgetCents, request.budget)}
            </p>
            <span
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              aria-label={`${request.offerCount} offers`}
            >
              <Inbox className="size-3.5" />
              {request.offerCount}
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              aria-label={`${request.viewCount} views`}
            >
              <Eye className="size-3.5" />
              {request.viewCount}
            </span>
          </div>
        </div>
      </Link>

      <button
        type="button"
        aria-label={isFavorite ? "Remove favorite" : "Save favorite"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          favorites.toggle(request.id);
        }}
        className="absolute right-2 top-2 z-10 rounded-lg bg-white/90 p-2 text-muted-foreground shadow-sm backdrop-blur-sm transition hover:bg-secondary hover:text-primary"
      >
        <Heart
          className={cn("size-4", isFavorite && "fill-primary text-primary")}
        />
      </button>
    </article>
  );
}

export function statusBadgeClass(status: string) {
  return STATUS_STYLES[status] ?? "bg-secondary text-secondary-foreground";
}
