"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { ApiError, register } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload = await register(email.trim(), password, displayName.trim());
      setSession(payload);
      router.push("/new");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create account");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="auth-shell">
        <h1>Create account</h1>
        <p>Join Hero to post requests and offer help.</p>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Display name
            <input
              className="field"
              required
              minLength={2}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label>
            Email
            <input
              className="field"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              className="field"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn btn--solid" type="submit" disabled={pending}>
            {pending ? "Creating…" : "Sign up"}
          </button>
        </form>
        <p className="form-footer">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </main>
    </>
  );
}
