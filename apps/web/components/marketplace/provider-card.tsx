import Link from "next/link";
import { Star } from "lucide-react";
import type { PublicUser } from "@monorepo/shared";
import { initials } from "@/lib/utils";

export function ProviderCard({ user }: { user: PublicUser }) {
  return (
    <Link
      href={`/providers/${user.id}`}
      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-white/70 p-4 transition hover:border-primary/35 hover:bg-white"
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt=""
          className="size-12 rounded-full object-cover"
        />
      ) : (
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary font-display text-sm font-semibold text-primary">
          {initials(user.profileName || user.displayName)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-semibold">
          {user.profileName || user.displayName}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="size-3.5 fill-accent text-accent" />
          {user.rating > 0 ? user.rating.toFixed(1) : "New"}
          <span aria-hidden>·</span>
          {user.reviewCount} review{user.reviewCount === 1 ? "" : "s"}
        </p>
      </div>
    </Link>
  );
}
