"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Star } from "lucide-react";
import {
  CITY_LABELS,
  createOfferSchema,
  type EstonianCity,
} from "@monorepo/shared";
import { statusBadgeClass } from "@/components/marketplace/request-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useOptionalUser } from "@/hooks/use-session";
import { api, ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { useRequest } from "@/lib/api/hooks";
import { formatBudget, formatRelativeTime, initials, cn } from "@/lib/utils";
import { toast } from "sonner";

export default function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, isLoading: sessionLoading } = useOptionalUser();
  const query = useRequest(id);
  const queryClient = useQueryClient();
  const [priceEuros, setPriceEuros] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void api.post(`/requests/${id}/views`).catch(() => undefined);
  }, [id]);

  const offerMutation = useMutation({
    mutationFn: async () => {
      const priceCents = priceEuros.trim()
        ? Math.round(Number(priceEuros) * 100)
        : undefined;
      const parsed = createOfferSchema.safeParse({
        priceCents:
          priceCents !== undefined && Number.isFinite(priceCents)
            ? priceCents
            : undefined,
        message: message.trim() || undefined,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid offer");
      }
      return api.post(`/requests/${id}/offers`, parsed.data);
    },
    onSuccess: async () => {
      toast.success("Offer sent");
      setMessage("");
      setPriceEuros("");
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.request(id) });
    },
    onError: (error) => {
      const text =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not send offer";
      setFormError(text);
      toast.error(text);
    },
  });

  if (query.isLoading || sessionLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <ErrorState
          description="This request couldn’t be loaded."
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const request = query.data;
  if (!request) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState title="Request not found" actionLabel="Browse" actionHref="/requests" />
      </div>
    );
  }

  const isOwner = user?.id === request.requester.id;
  const canOffer =
    Boolean(user) && !isOwner && request.status === "OPEN" && !request.viewerOffer;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge className={cn(statusBadgeClass(request.status))}>
          {request.status.replaceAll("_", " ")}
        </Badge>
        {request.isPremium ? (
          <Badge className="bg-accent/90 text-accent-foreground">Premium</Badge>
        ) : null}
        <span className="text-sm text-muted-foreground">
          {formatRelativeTime(request.createdAt)} · {request.viewCount} views ·{" "}
          {request.offerCount} offers
        </span>
      </div>

      <h1 className="font-display text-4xl font-bold tracking-tight">
        {request.title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {request.categoryName} ·{" "}
        {CITY_LABELS[request.city as EstonianCity] ?? request.city}
      </p>
      <p className="mt-4 text-lg font-semibold text-primary">
        {formatBudget(request.budgetCents, request.budget)}
      </p>

      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="size-4" />
        {request.location}
      </div>

      <div className="mt-8 prose-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
        {request.description}
      </div>

      {request.photos.length > 0 ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {request.photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={photo.url}
              alt=""
              className="h-48 w-full rounded-2xl object-cover"
            />
          ))}
        </div>
      ) : null}

      <div className="mt-10 flex items-center gap-3 rounded-2xl border border-border bg-white/70 p-4">
        {request.requester.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={request.requester.avatarUrl}
            alt=""
            className="size-12 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary font-display text-sm font-semibold text-primary">
            {initials(request.requester.profileName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/providers/${request.requester.id}`}
            className="font-display font-semibold hover:text-primary"
          >
            {request.requester.profileName}
          </Link>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3.5 fill-accent text-accent" />
            {request.requester.rating > 0
              ? request.requester.rating.toFixed(1)
              : "New"}{" "}
            · {request.requester.reviewCount} reviews
          </p>
        </div>
      </div>

      {request.viewerOffer ? (
        <div className="mt-8 rounded-2xl border border-border bg-mist/60 p-5">
          <h2 className="font-display text-lg font-semibold">Your offer</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Status: {request.viewerOffer.status}
            {request.viewerOffer.priceCents != null
              ? ` · ${formatBudget(request.viewerOffer.priceCents)}`
              : ""}
          </p>
          {request.viewerOffer.message ? (
            <p className="mt-2 text-sm">{request.viewerOffer.message}</p>
          ) : null}
        </div>
      ) : null}

      {canOffer ? (
        <form
          className="mt-8 space-y-4 rounded-2xl border border-border bg-white p-5"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            offerMutation.mutate();
          }}
        >
          <h2 className="font-display text-lg font-semibold">Send an offer</h2>
          <div className="space-y-2">
            <Label htmlFor="price">Price (EUR, optional)</Label>
            <Input
              id="price"
              type="number"
              min="1"
              step="0.01"
              value={priceEuros}
              onChange={(event) => setPriceEuros(event.target.value)}
              placeholder="e.g. 45"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Introduce yourself and your availability"
            />
          </div>
          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}
          <Button type="submit" disabled={offerMutation.isPending}>
            {offerMutation.isPending ? "Sending…" : "Submit offer"}
          </Button>
        </form>
      ) : null}

      {!user && request.status === "OPEN" ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Log in to send an offer on this request.
          </p>
          <Button asChild className="mt-3">
            <Link href={`/login?callbackUrl=/requests/${id}`}>Log in</Link>
          </Button>
        </div>
      ) : null}

      {isOwner ? (
        <p className="mt-8 text-sm text-muted-foreground">
          This is your request. Manage offers from your{" "}
          <Link href="/dashboard" className="text-primary underline-offset-2 hover:underline">
            dashboard
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
