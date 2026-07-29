"use client";

import Link from "next/link";
import { useAuth } from "./auth-provider";

export function SiteHeaderAuth() {
  const { user, ready, clearSession } = useAuth();

  if (!ready) return <span className="nav-ghost">…</span>;

  if (user) {
    return (
      <span className="nav-auth">
        <span className="nav-user">{user.displayName}</span>
        <button type="button" className="nav-text-btn" onClick={clearSession}>
          Log out
        </button>
      </span>
    );
  }

  return (
    <Link href="/login" className="nav-cta">
      Log in
    </Link>
  );
}
