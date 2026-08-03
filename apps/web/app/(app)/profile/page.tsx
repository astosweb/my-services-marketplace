"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateProfileSchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptionalUser } from "@/hooks/use-session";
import { api, ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { initials } from "@/lib/utils";
import type { MeUser } from "@monorepo/shared";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user, isLoading } = useOptionalUser();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName || user.profileName || "");
    setBio(user.bio ?? "");
    setBusinessName(user.businessName ?? "");
    setAvatarPreview(user.avatarUrl);
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const parsed = updateProfileSchema.safeParse({
      displayName: displayName.trim() || undefined,
      bio: bio.trim() || undefined,
      businessName: businessName.trim() || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid profile");
      setPending(false);
      return;
    }
    try {
      await api.patch<MeUser>("/auth/me", parsed.data);
      await queryClient.invalidateQueries({ queryKey: queryKeys.session });
      toast.success("Profile updated");
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "Update failed";
      setError(text);
      toast.error(text);
    } finally {
      setPending(false);
    }
  }

  async function onAvatarChange(file: File | undefined) {
    if (!file) return;
    setPending(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const uploaded = await api.upload<{ key: string }>("/uploads/avatars", form);
      await api.patch("/auth/me", { avatarKey: uploaded.key });
      await queryClient.invalidateQueries({ queryKey: queryKeys.session });
      setAvatarPreview(URL.createObjectURL(file));
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight">Profile</h1>
      <p className="mt-2 text-muted-foreground">
        How you appear to neighbors on Bidy.
      </p>

      <div className="mt-8 flex items-center gap-4">
        {avatarPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarPreview}
            alt=""
            className="size-20 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-20 items-center justify-center rounded-full bg-secondary font-display text-xl font-semibold text-primary">
            {initials(displayName || user.email)}
          </span>
        )}
        <div>
          <Label htmlFor="avatar" className="cursor-pointer text-primary">
            Change photo
          </Label>
          <Input
            id="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-2"
            onChange={(event) => void onAvatarChange(event.target.files?.[0])}
          />
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessName">Business name</Label>
          <Input
            id="businessName"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="A short intro"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </div>
  );
}
