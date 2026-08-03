"use client";

import { use } from "react";
import { Star } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser, useUserReviews } from "@/lib/api/hooks";
import { formatRelativeTime, initials } from "@/lib/utils";

export default function ProviderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const userQuery = useUser(id);
  const reviewsQuery = useUserReviews(id);

  if (userQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (userQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState
          description="Couldn’t load this profile."
          onRetry={() => void userQuery.refetch()}
        />
      </div>
    );
  }

  const user = userQuery.data;
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState title="Profile not found" actionLabel="Explore" actionHref="/explore" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            className="size-24 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-24 items-center justify-center rounded-full bg-secondary font-display text-2xl font-semibold text-primary">
            {initials(user.profileName || user.displayName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            {user.profileName || user.displayName}
          </h1>
          {user.businessName ? (
            <p className="mt-1 text-sm text-muted-foreground">{user.businessName}</p>
          ) : null}
          <p className="mt-3 flex items-center gap-1 text-sm">
            <Star className="size-4 fill-accent text-accent" />
            {user.rating > 0 ? user.rating.toFixed(1) : "New"} · {user.reviewCount}{" "}
            reviews · Member since{" "}
            {new Date(user.memberSince).toLocaleDateString("en-GB", {
              month: "short",
              year: "numeric",
            })}
          </p>
          {user.bio ? (
            <p className="mt-4 text-sm leading-relaxed text-foreground/90">
              {user.bio}
            </p>
          ) : null}
        </div>
      </div>

      <h2 className="mt-12 font-display text-2xl font-semibold">Reviews</h2>
      {reviewsQuery.isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : reviewsQuery.isError ? (
        <div className="mt-4">
          <ErrorState
            description="Reviews failed to load."
            onRetry={() => void reviewsQuery.refetch()}
          />
        </div>
      ) : !reviewsQuery.data?.items.length ? (
        <div className="mt-4">
          <EmptyState
            title="No reviews yet"
            description="Completed jobs will show feedback here."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {reviewsQuery.data.items.map((review) => (
            <li
              key={review.id}
              className="rounded-2xl border border-border/80 bg-white/70 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">
                  {review.author.profileName}
                </p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="size-3.5 fill-accent text-accent" />
                  {review.rating}
                  <span aria-hidden>·</span>
                  {formatRelativeTime(review.createdAt)}
                </p>
              </div>
              {review.body ? (
                <p className="mt-2 text-sm text-foreground/90">{review.body}</p>
              ) : null}
              {review.request ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  For {review.request.title}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
