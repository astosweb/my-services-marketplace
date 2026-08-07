"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CategoryDto, NotificationPreferencesDto } from "@monorepo/shared";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { useCategories } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function PreferencesEditor({
  initialIds,
  maxSelections,
  categories,
}: {
  initialIds: string[];
  maxSelections: number;
  categories: CategoryDto[];
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(initialIds);

  const savePrefs = useMutation({
    mutationFn: (categoryIds: string[]) =>
      api.put("/notifications/preferences", { categoryIds }),
    onSuccess: async () => {
      toast.success("Preferences saved");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.notificationPreferences,
      });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Save failed");
    },
  });

  function toggleCategory(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= maxSelections) {
        toast.error(`You can select at most ${maxSelections} categories`);
        return current;
      }
      return [...current, id];
    });
  }

  return (
    <>
      <ul className="mt-4 space-y-2">
        {categories.map((category) => {
          const active = selected.includes(category.id);
          return (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition",
                  active
                    ? "border-primary bg-secondary"
                    : "border-border bg-white/70 hover:bg-white",
                )}
              >
                <span className="font-medium">{category.name}</span>
                <span className="text-xs text-muted-foreground">
                  {active ? "Selected" : "Tap to select"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Button
        className="mt-4"
        disabled={savePrefs.isPending}
        onClick={() => savePrefs.mutate(selected)}
      >
        {savePrefs.isPending ? "Saving…" : "Save preferences"}
      </Button>
    </>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const categoriesQuery = useCategories();
  const prefsQuery = useQuery({
    queryKey: queryKeys.notificationPreferences,
    queryFn: () =>
      api.get<NotificationPreferencesDto>("/notifications/preferences"),
  });
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onDelete(event: FormEvent) {
    event.preventDefault();
    setDeleteError(null);
    if (!password.trim()) {
      setDeleteError("Password is required");
      return;
    }
    try {
      await api.delete("/auth/me", { password });
      await api.post("/auth/logout").catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: queryKeys.session });
      toast.success("Account deleted");
      router.push("/");
      router.refresh();
    } catch (err) {
      const text =
        err instanceof ApiError ? err.message : "Could not delete account";
      setDeleteError(text);
      toast.error(text);
    }
  }

  const maxSelections = prefsQuery.data?.maxSelections ?? 3;
  const categories: CategoryDto[] = categoriesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight">
        Settings
      </h1>
      <p className="mt-2 text-muted-foreground">
        Notification preferences and account controls.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">
          Notification categories
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose up to {maxSelections} categories to hear about.
        </p>

        {prefsQuery.isLoading || categoriesQuery.isLoading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 rounded-xl" />
            ))}
          </div>
        ) : prefsQuery.isError || categoriesQuery.isError ? (
          <div className="mt-4">
            <ErrorState
              description="Preferences failed to load."
              onRetry={() => {
                void prefsQuery.refetch();
                void categoriesQuery.refetch();
              }}
            />
          </div>
        ) : categories.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No categories available" />
          </div>
        ) : prefsQuery.data ? (
          <PreferencesEditor
            key={prefsQuery.data.categoryIds.join(",")}
            initialIds={prefsQuery.data.categoryIds}
            maxSelections={maxSelections}
            categories={categories}
          />
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Help & support</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Need help with your account or a job? Open a support ticket.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/support">Go to support</Link>
        </Button>
      </section>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-display text-xl font-semibold text-destructive">
          Delete account
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently remove your Gobid account and personal data. This cannot be
          undone.
        </p>
        <form onSubmit={onDelete} className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="password">Confirm with password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
          {deleteError ? (
            <p className="text-sm text-destructive">{deleteError}</p>
          ) : null}
          <Button type="submit" variant="destructive">
            Delete my account
          </Button>
        </form>
      </section>
    </div>
  );
}
