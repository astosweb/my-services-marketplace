"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Star } from "lucide-react";
import {
  CITY_LABELS,
  createOfferSchema,
  createReviewSchema,
  type EstonianCity,
  type MarketplaceOffer,
  type MarketplaceRequest,
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
import { useRealtime } from "@/lib/realtime/provider";
import { formatBudget, formatRelativeTime, initials, cn } from "@/lib/utils";
import { toast } from "sonner";

function errorText(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isLoading: sessionLoading } = useOptionalUser();
  const query = useRequest(id);
  const queryClient = useQueryClient();
  const [priceEuros, setPriceEuros] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");

  useEffect(() => {
    if (!id) return;
    void api.post(`/requests/${id}/views`).catch(() => undefined);
  }, [id]);

  const realtime = useRealtime();
  useEffect(() => {
    if (!id) return;
    realtime.joinRequest(id);
    return () => realtime.leaveRequest(id);
  }, [id, realtime]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.request(id) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.requestOffers(id) });
  };

  const offersQuery = useQuery({
    queryKey: queryKeys.requestOffers(id),
    queryFn: () => api.get<MarketplaceOffer[]>(`/requests/${id}/offers`),
    enabled: Boolean(id && user && query.data?.requester.id === user.id),
  });

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
      await invalidate();
    },
    onError: (error) => {
      const text = errorText(error, "Could not send offer");
      setFormError(text);
      toast.error(text);
    },
  });

  const offerStatusMutation = useMutation({
    mutationFn: ({
      offerId,
      status,
    }: {
      offerId: string;
      status: "ACCEPTED" | "DECLINED" | "WITHDRAWN";
    }) => api.patch(`/requests/${id}/offers/${offerId}`, { status }),
    onSuccess: async (_data, variables) => {
      toast.success(
        variables.status === "ACCEPTED"
          ? "Offer accepted"
          : variables.status === "DECLINED"
            ? "Offer declined"
            : "Offer withdrawn",
      );
      await invalidate();
    },
    onError: (error) => toast.error(errorText(error, "Could not update offer")),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "COMPLETED" | "CANCELLED") =>
      api.patch(`/requests/${id}/status`, { status }),
    onSuccess: async (_data, status) => {
      toast.success(status === "COMPLETED" ? "Job completed" : "Request cancelled");
      await invalidate();
    },
    onError: (error) => toast.error(errorText(error, "Could not update status")),
  });

  const progressMutation = useMutation({
    mutationFn: (status: "ON_THE_WAY" | "STARTED" | "PROVIDER_DONE") =>
      api.patch(`/requests/${id}/progress`, { status }),
    onSuccess: async () => {
      toast.success("Progress updated");
      await invalidate();
    },
    onError: (error) => toast.error(errorText(error, "Could not update progress")),
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const parsed = createReviewSchema.safeParse({
        rating: reviewRating,
        body: reviewBody.trim() || undefined,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid review");
      }
      return api.post(`/requests/${id}/reviews`, parsed.data);
    },
    onSuccess: async () => {
      toast.success("Review submitted");
      setReviewBody("");
      await invalidate();
    },
    onError: (error) => toast.error(errorText(error, "Could not submit review")),
  });

  const conversationMutation = useMutation({
    mutationFn: async (peerUserId?: string) => {
      return api.post<{ id: string }>(`/requests/${id}/conversation`, {
        peerUserId,
      });
    },
    onSuccess: (conversation) => {
      router.push(`/messages/${conversation.id}`);
    },
    onError: (error) => toast.error(errorText(error, "Could not open chat")),
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

  return (
    <RequestDetailBody
      id={id}
      request={request}
      userId={user?.id}
      offers={offersQuery.data ?? []}
      offersLoading={offersQuery.isLoading}
      priceEuros={priceEuros}
      setPriceEuros={setPriceEuros}
      message={message}
      setMessage={setMessage}
      formError={formError}
      reviewRating={reviewRating}
      setReviewRating={setReviewRating}
      reviewBody={reviewBody}
      setReviewBody={setReviewBody}
      offerPending={offerMutation.isPending}
      onSubmitOffer={() => offerMutation.mutate()}
      onOfferStatus={(offerId, status) =>
        offerStatusMutation.mutate({ offerId, status })
      }
      offerStatusPending={offerStatusMutation.isPending}
      onStatus={(status) => statusMutation.mutate(status)}
      statusPending={statusMutation.isPending}
      onProgress={(status) => progressMutation.mutate(status)}
      progressPending={progressMutation.isPending}
      onReview={() => reviewMutation.mutate()}
      reviewPending={reviewMutation.isPending}
      onOpenChat={(peerUserId) => conversationMutation.mutate(peerUserId)}
      chatPending={conversationMutation.isPending}
    />
  );
}

function RequestDetailBody({
  id,
  request,
  userId,
  offers,
  offersLoading,
  priceEuros,
  setPriceEuros,
  message,
  setMessage,
  formError,
  reviewRating,
  setReviewRating,
  reviewBody,
  setReviewBody,
  offerPending,
  onSubmitOffer,
  onOfferStatus,
  offerStatusPending,
  onStatus,
  statusPending,
  onProgress,
  progressPending,
  onReview,
  reviewPending,
  onOpenChat,
  chatPending,
}: {
  id: string;
  request: MarketplaceRequest;
  userId?: string;
  offers: MarketplaceOffer[];
  offersLoading: boolean;
  priceEuros: string;
  setPriceEuros: (value: string) => void;
  message: string;
  setMessage: (value: string) => void;
  formError: string | null;
  reviewRating: number;
  setReviewRating: (value: number) => void;
  reviewBody: string;
  setReviewBody: (value: string) => void;
  offerPending: boolean;
  onSubmitOffer: () => void;
  onOfferStatus: (
    offerId: string,
    status: "ACCEPTED" | "DECLINED" | "WITHDRAWN",
  ) => void;
  offerStatusPending: boolean;
  onStatus: (status: "COMPLETED" | "CANCELLED") => void;
  statusPending: boolean;
  onProgress: (status: "ON_THE_WAY" | "STARTED" | "PROVIDER_DONE") => void;
  progressPending: boolean;
  onReview: () => void;
  reviewPending: boolean;
  onOpenChat: (peerUserId?: string) => void;
  chatPending: boolean;
}) {
  const isOwner = userId === request.requester.id;
  const isAcceptedProvider = Boolean(
    userId && request.acceptedOffer?.provider.id === userId,
  );
  const canOffer =
    Boolean(userId) && !isOwner && request.status === "OPEN" && !request.viewerOffer;
  const canWithdraw =
    Boolean(request.viewerOffer) &&
    request.viewerOffer?.status === "PENDING" &&
    request.status === "OPEN";
  const canOwnerManageOffers = isOwner && request.status === "OPEN";
  const canCancel =
    isOwner && (request.status === "OPEN" || request.status === "PENDING_REVIEW");
  const canComplete =
    isOwner &&
    request.status === "IN_PROGRESS" &&
    request.progressStatus === "PROVIDER_DONE";
  const canProgress =
    isAcceptedProvider && request.status === "IN_PROGRESS";
  const canReview =
    Boolean(userId) &&
    request.status === "COMPLETED" &&
    (isOwner || isAcceptedProvider);
  const canOpenConversation =
    Boolean(userId) &&
    (isOwner || isAcceptedProvider) &&
    request.status !== "OPEN";
  const canMessageOwner =
    Boolean(userId) &&
    !isOwner &&
    (request.viewerOffer?.status === "PENDING" ||
      request.viewerOffer?.status === "ACCEPTED") &&
    !canOpenConversation;
  const defaultChatPeerId = isOwner
    ? request.acceptedOffer?.provider.id
    : request.requester.id;

  const nextProgress: Array<"ON_THE_WAY" | "STARTED" | "PROVIDER_DONE"> = [];
  if (canProgress) {
    const current = request.progressStatus ?? "ACCEPTED";
    if (current === "ACCEPTED") nextProgress.push("ON_THE_WAY");
    if (current === "ACCEPTED" || current === "ON_THE_WAY") nextProgress.push("STARTED");
    if (
      current === "ACCEPTED" ||
      current === "ON_THE_WAY" ||
      current === "STARTED"
    ) {
      nextProgress.push("PROVIDER_DONE");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge className={cn(statusBadgeClass(request.status))}>
          {request.status.replaceAll("_", " ")}
        </Badge>
        {request.progressStatus ? (
          <Badge className="border border-border bg-transparent">
            {request.progressStatus.replaceAll("_", " ")}
          </Badge>
        ) : null}
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
      {canCancel && request.offerCount === 0 ? (
        <div className="mt-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/requests/${request.id}/edit`}>Edit request</Link>
          </Button>
        </div>
      ) : null}
      <p className="mt-4 text-lg font-semibold text-primary">
        {formatBudget(request.budgetCents, request.budget)}
      </p>

      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="size-4" />
        {request.location || "Location shared after accept"}
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

      {request.acceptedOffer ? (
        <div className="mt-8 rounded-2xl border border-border bg-mist/60 p-5">
          <h2 className="font-display text-lg font-semibold">Accepted provider</h2>
          <p className="mt-2 text-sm">
            {request.acceptedOffer.provider.profileName}
            {request.acceptedOffer.priceCents != null
              ? ` · ${formatBudget(request.acceptedOffer.priceCents)}`
              : ""}
          </p>
        </div>
      ) : null}

      {request.progressEvents?.length ? (
        <div className="mt-8 rounded-2xl border border-border bg-white/70 p-5">
          <h2 className="font-display text-lg font-semibold">Progress</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {request.progressEvents.map((event) => (
              <li key={event.id}>
                {event.status.replaceAll("_", " ")} ·{" "}
                {formatRelativeTime(event.createdAt)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canMessageOwner ? (
        <div className="mt-8 rounded-2xl border border-border bg-white p-5">
          <button
            type="button"
            disabled={chatPending}
            onClick={() => onOpenChat(request.requester.id)}
            className="flex w-full items-center gap-3 text-left transition hover:opacity-90"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {initials(request.requester.profileName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display font-semibold">
                Message {request.requester.profileName}
              </span>
              <span className="block text-sm text-muted-foreground">
                Ask a question about this request
              </span>
            </span>
            <span className="text-sm text-primary">
              {chatPending ? "Opening…" : "Chat"}
            </span>
          </button>
        </div>
      ) : null}

      {canOwnerManageOffers ? (
        <div className="mt-8 space-y-3 rounded-2xl border border-border bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Offers</h2>
          {offersLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : offers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No offers yet.</p>
          ) : (
            offers.map((offer) => (
              <div
                key={offer.id}
                className="flex flex-col gap-3 rounded-xl border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{offer.offerer.profileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {offer.status}
                    {offer.priceCents != null
                      ? ` · ${formatBudget(offer.priceCents)}`
                      : ""}
                  </p>
                  {offer.message ? (
                    <p className="mt-1 text-sm">{offer.message}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {offer.status === "PENDING" || offer.status === "ACCEPTED" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={chatPending}
                      onClick={() => onOpenChat(offer.offerer.id)}
                    >
                      Message
                    </Button>
                  ) : null}
                  {offer.status === "PENDING" ? (
                    <>
                      <Button
                        size="sm"
                        disabled={offerStatusPending}
                        onClick={() => onOfferStatus(offer.id, "ACCEPTED")}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={offerStatusPending}
                        onClick={() => onOfferStatus(offer.id, "DECLINED")}
                      >
                        Decline
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

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
          {canWithdraw ? (
            <Button
              className="mt-4"
              variant="outline"
              size="sm"
              disabled={offerStatusPending}
              onClick={() =>
                onOfferStatus(request.viewerOffer!.id, "WITHDRAWN")
              }
            >
              Withdraw offer
            </Button>
          ) : null}
        </div>
      ) : null}

      {canOffer ? (
        <form
          className="mt-8 space-y-4 rounded-2xl border border-border bg-white p-5"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            onSubmitOffer();
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
          <Button type="submit" disabled={offerPending}>
            {offerPending ? "Sending…" : "Submit offer"}
          </Button>
        </form>
      ) : null}

      {canProgress ? (
        <div className="mt-8 space-y-3 rounded-2xl border border-border bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Update job progress</h2>
          <div className="flex flex-wrap gap-2">
            {nextProgress.map((status) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                disabled={progressPending}
                onClick={() => onProgress(status)}
              >
                Mark {status.replaceAll("_", " ").toLowerCase()}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {(canCancel || canComplete || canOpenConversation) && (
        <div className="mt-8 flex flex-wrap gap-2">
          {canOpenConversation ? (
            <Button
              disabled={chatPending}
              onClick={() => onOpenChat(defaultChatPeerId)}
            >
              {chatPending ? "Opening…" : "Open chat"}
            </Button>
          ) : null}
          {canComplete ? (
            <Button disabled={statusPending} onClick={() => onStatus("COMPLETED")}>
              Confirm completion
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              variant="outline"
              disabled={statusPending}
              onClick={() => onStatus("CANCELLED")}
            >
              Cancel request
            </Button>
          ) : null}
        </div>
      )}

      {canReview ? (
        <form
          className="mt-8 space-y-4 rounded-2xl border border-border bg-white p-5"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            onReview();
          }}
        >
          <h2 className="font-display text-lg font-semibold">Leave a review</h2>
          <div className="space-y-2">
            <Label htmlFor="rating">Rating</Label>
            <select
              id="rating"
              className="flex h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
              value={reviewRating}
              onChange={(event) => setReviewRating(Number(event.target.value))}
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} star{value === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-body">Comment (optional)</Label>
            <Textarea
              id="review-body"
              value={reviewBody}
              onChange={(event) => setReviewBody(event.target.value)}
              maxLength={1000}
            />
          </div>
          <Button type="submit" disabled={reviewPending}>
            {reviewPending ? "Submitting…" : "Submit review"}
          </Button>
        </form>
      ) : null}

      {!userId && request.status === "OPEN" ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Log in to send an offer on this request.
          </p>
          <Button asChild className="mt-3">
            <Link href={`/login?callbackUrl=/requests/${id}`}>Log in</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
