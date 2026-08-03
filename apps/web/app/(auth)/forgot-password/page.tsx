"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { forgotPasswordSchema } from "@/lib/validations";
import { api, ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const parsed = forgotPasswordSchema.safeParse({
      email: String(form.get("email") ?? ""),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email");
      setPending(false);
      return;
    }
    try {
      await api.post("/auth/forgot-password", parsed.data);
      setDone(true);
      toast.success("Check your email for reset instructions");
    } catch (err) {
      const text =
        err instanceof ApiError ? err.message : "Request failed";
      setError(text);
      toast.error(text);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold">Forgot password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We’ll email you a link to reset it.
      </p>
      {done ? (
        <p className="mt-6 text-sm text-muted-foreground">
          If an account exists for that email, reset instructions are on the way.{" "}
          <Link href="/login" className="text-primary hover:underline">
            Back to login
          </Link>
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </>
  );
}
