"use client";

import { use, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CITY_COORDINATES,
  CITY_LABELS,
  ESTONIAN_CITIES,
  createRequestSchema,
  type EstonianCity,
  type MarketplaceRequest,
} from "@monorepo/shared";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useOptionalUser } from "@/hooks/use-session";
import { api, ApiError } from "@/lib/api/client";
import { useCategories, useRequest } from "@/lib/api/hooks";
import { toast } from "sonner";

export default function EditRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isLoading: sessionLoading } = useOptionalUser();
  const requestQuery = useRequest(id);
  const categoriesQuery = useCategories();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<FileList | null>(null);

  if (sessionLoading || requestQuery.isLoading || categoriesQuery.isLoading) {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-3xl font-bold">Edit request</h1>
        <Button asChild className="mt-6">
          <Link href={`/login?callbackUrl=/requests/${id}/edit`}>Log in</Link>
        </Button>
      </div>
    );
  }

  if (requestQuery.isError || !requestQuery.data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <ErrorState
          description="Request could not be loaded."
          onRetry={() => void requestQuery.refetch()}
        />
      </div>
    );
  }

  const request = requestQuery.data;
  const canEdit =
    request.requester.id === user.id &&
    (request.status === "OPEN" || request.status === "PENDING_REVIEW") &&
    request.offerCount === 0;

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-3xl font-bold">Cannot edit</h1>
        <p className="mt-2 text-muted-foreground">
          Only the owner can edit pending or open requests with no offers.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link href={`/requests/${id}`}>Back to request</Link>
        </Button>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>, current: MarketplaceRequest) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData(event.currentTarget);
      const city = String(form.get("city") ?? current.city) as EstonianCity;
      const pricingMode =
        (form.get("pricingMode") as string) === "OWNER_FIXED_PRICE"
          ? "OWNER_FIXED_PRICE"
          : "PROVIDER_OFFERS";
      const budgetEuros = String(form.get("budgetEuros") ?? "").trim();
      const budgetCents = budgetEuros
        ? Math.round(Number(budgetEuros) * 100)
        : undefined;
      const coords = CITY_COORDINATES[city];

      let photoKeys: string[] | undefined;
      if (photos && photos.length > 0) {
        const upload = new FormData();
        Array.from(photos)
          .slice(0, 9)
          .forEach((file) => upload.append("photos", file));
        const uploaded = await api.upload<{ keys: string[] }>(
          "/uploads/request-photos",
          upload,
        );
        photoKeys = uploaded.keys;
      }

      const payload = {
        categoryId: String(form.get("categoryId") ?? ""),
        title: String(form.get("title") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
        city,
        latitude: coords.latitude,
        longitude: coords.longitude,
        location: String(form.get("location") ?? "").trim(),
        pricingMode,
        budgetCents,
        budgetLabel: String(form.get("budgetLabel") ?? "").trim() || undefined,
        photoKeys,
      };

      const parsed = createRequestSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid form");
      }

      await api.patch(`/requests/${id}`, parsed.data);
      toast.success("Request updated");
      router.push(`/requests/${id}`);
    } catch (err) {
      const text =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not update request";
      setError(text);
      toast.error(text);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link
        href={`/requests/${id}`}
        className="text-sm text-primary underline-offset-2 hover:underline"
      >
        ← Back
      </Link>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">
        Edit request
      </h1>
      <p className="mt-2 text-muted-foreground">
        Update details before offers arrive.
      </p>

      <form
        className="mt-8 space-y-5 rounded-2xl border border-border bg-white p-6"
        onSubmit={(event) => void onSubmit(event, request)}
      >
        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={request.categoryId}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {(categoriesQuery.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required defaultValue={request.title} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            required
            rows={6}
            defaultValue={request.description}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <select
              id="city"
              name="city"
              defaultValue={request.city}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {ESTONIAN_CITIES.map((city) => (
                <option key={city} value={city}>
                  {CITY_LABELS[city]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location detail</Label>
            <Input
              id="location"
              name="location"
              defaultValue={request.location}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pricingMode">Pricing</Label>
          <select
            id="pricingMode"
            name="pricingMode"
            defaultValue={request.pricingMode}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="PROVIDER_OFFERS">Providers send offers</option>
            <option value="OWNER_FIXED_PRICE">Fixed price</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="budgetEuros">Budget (€)</Label>
            <Input
              id="budgetEuros"
              name="budgetEuros"
              type="number"
              min={1}
              step="1"
              defaultValue={
                request.budgetCents != null
                  ? String(request.budgetCents / 100)
                  : ""
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budgetLabel">Budget label</Label>
            <Input
              id="budgetLabel"
              name="budgetLabel"
              defaultValue={request.budget ?? ""}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="photos">Replace photos (optional)</Label>
          <Input
            id="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => setPhotos(event.target.files)}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
