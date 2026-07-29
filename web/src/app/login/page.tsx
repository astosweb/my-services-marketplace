"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { ApiError, login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload = await login(email.trim(), password);
      setSession(payload);
      router.push("/explore");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="auth-shell">
        <h1>Log in</h1>
        <p>Welcome back to Hero.</p>
        <form className="form" onSubmit={onSubmit}>
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
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn btn--solid" type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Log in"}
          </button>
        </form>
        <p className="form-footer">
          No account? <Link href="/register">Sign up</Link>
          {" · "}
          <Link href="/reset-password">Forgot password</Link>
        </p>
      </main>
    </>
  );
}
