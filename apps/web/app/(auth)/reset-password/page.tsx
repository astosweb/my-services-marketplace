"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { resetPasswordSchema } from "@/lib/validations";
import { api, ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const parsed = resetPasswordSchema.safeParse({
      token,
      password: String(form.get("password") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      setPending(false);
      return;
    }
    try {
      await api.post("/auth/reset-password", {
        token: parsed.data.token,
        password: parsed.data.password,
      });
      toast.success("Password updated");
      router.push("/login");
    } catch (err) {
      const text =
        err instanceof ApiError ? err.message : "Reset failed";
      setError(text);
      toast.error(text);
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <>
        <h1 className="font-display text-2xl font-bold">Invalid link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This reset link is missing a token.{" "}
          <Link href="/forgot-password" className="text-primary hover:underline">
            Request a new one
          </Link>
          .
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold">Reset password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose a new password for your account.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
