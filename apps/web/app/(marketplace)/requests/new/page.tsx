"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  CITY_COORDINATES,
  CITY_LABELS,
  ESTONIAN_CITIES,
  createRequestSchema,
  type EstonianCity,
} from "@monorepo/shared";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOptionalUser } from "@/hooks/use-session";
import { api, ApiError } from "@/lib/api/client";
import { useCategories } from "@/lib/api/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { toast } from "sonner";

export default function NewRequestPage() {
  const router = useRouter();
  const { user, isLoading: sessionLoading } = useOptionalUser();
  const categoriesQuery = useCategories();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState<EstonianCity>("TALLINN");
  const [photos, setPhotos] = useState<FileList | null>(null);

  if (sessionLoading) {
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
        <h1 className="font-display text-3xl font-bold">Post a request</h1>
        <p className="mt-2 text-muted-foreground">
          Log in to create a service request on Gobid.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login?callbackUrl=/requests/new">Log in</Link>
        </Button>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const form = new FormData(event.currentTarget);
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
        isPremium: form.get("isPremium") === "on",
        photoKeys,
      };

      const parsed = createRequestSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid form");
      }

      const created = await api.post<{ id: string }>("/requests", parsed.data);
      toast.success("Request submitted for review");
      router.push(`/requests/${created.id}`);
    } catch (err) {
      const text =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not create request";
      setError(text);
      toast.error(text);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight">
        Post a request
      </h1>
      <p className="mt-2 text-muted-foreground">
        Tell neighbors what you need. Requests are reviewed before going live.
      </p>

      {categoriesQuery.isError ? (
        <div className="mt-6">
          <ErrorState
            description="Categories failed to load."
            onRetry={() => void categoriesQuery.refetch()}
          />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="categoryId">Category</Label>
            {categoriesQuery.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                id="categoryId"
                name="categoryId"
                required
                className="flex h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
              >
                <option value="">Select a category</option>
                {(categoriesQuery.data ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              minLength={3}
              placeholder="e.g. Fix dripping kitchen tap"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              required
              minLength={10}
              placeholder="What needs doing, access notes, timing…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <select
                id="city"
                value={city}
                onChange={(event) => setCity(event.target.value as EstonianCity)}
                className="flex h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
              >
                {ESTONIAN_CITIES.map((value) => (
                  <option key={value} value={value}>
                    {CITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                required
                placeholder="Neighborhood or address hint"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricingMode">Pricing</Label>
            <select
              id="pricingMode"
              name="pricingMode"
              className="flex h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
              defaultValue="PROVIDER_OFFERS"
            >
              <option value="PROVIDER_OFFERS">Providers send offers</option>
              <option value="OWNER_FIXED_PRICE">Fixed price</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budgetEuros">Budget (EUR)</Label>
              <Input
                id="budgetEuros"
                name="budgetEuros"
                type="number"
                min="1"
                step="0.01"
                placeholder="Optional / required for fixed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budgetLabel">Budget label</Label>
              <Input
                id="budgetLabel"
                name="budgetLabel"
                placeholder="e.g. €40–60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="photos">Photos (up to 9)</Label>
            <Input
              id="photos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => setPhotos(event.target.files)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPremium" className="size-4 rounded" />
            Mark as premium listing
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
        </form>
      )}
    </div>
  );
}
