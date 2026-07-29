"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { ApiError, forgotPassword, resetPassword } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"request" | "reset">(tokenFromUrl ? "reset" : "request");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await forgotPassword(email.trim());
      setMessage(result.message);
      if (result.token) {
        setToken(result.token);
        setMode("reset");
        setMessage(`${result.message} Dev token ready — set a new password below.`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await resetPassword(token.trim(), password);
      setMessage("Password updated. You can log in now.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-shell">
      <h1>Reset password</h1>
      <p>Recover access to your Hero account.</p>

      {mode === "request" ? (
        <form className="form" onSubmit={onRequest}>
          <label>
            Email
            <input
              className="field"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-success">{message}</p> : null}
          <button className="btn btn--solid" type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </button>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => setMode("reset")}
          >
            I already have a token
          </button>
        </form>
      ) : (
        <form className="form" onSubmit={onReset}>
          <label>
            Reset token
            <input
              className="field"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <label>
            New password
            <input
              className="field"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-success">{message}</p> : null}
          <button className="btn btn--solid" type="submit" disabled={pending}>
            {pending ? "Updating…" : "Update password"}
          </button>
        </form>
      )}

      <p className="form-footer">
        <Link href="/login">Back to log in</Link>
      </p>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<p className="auth-shell empty-state">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
