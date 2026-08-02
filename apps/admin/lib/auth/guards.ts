import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAccessToken,
  getRefreshToken,
  nestFetch,
  NestRequestError,
} from "@/lib/api/nest";
import { clearAuthCookies } from "@/lib/auth/token-cookies";
import {
  SESSION_EXPIRED_PATH,
  SESSION_REFRESH_PATH,
} from "@/lib/auth/constants";
import type { SessionUser } from "@/lib/auth/types";

type NestMe = {
  data: {
    id: string;
    email: string;
    displayName: string;
    profileName?: string;
    avatarUrl?: string | null;
    role?: string;
    permissions?: string[];
  };
};

/**
 * Resolves the current admin from the access-token cookie only.
 * Must not set/clear cookies — layouts/RSC cannot mutate the cookie jar.
 * Token refresh (and rotation) happens in route handlers / session-refresh.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  try {
    const me = await nestFetch<NestMe>("/auth/me", { accessToken });
    if (me.data.role !== "ADMIN") return null;
    return {
      id: me.data.id,
      email: me.data.email,
      name: me.data.profileName ?? me.data.displayName,
      displayName: me.data.displayName,
      avatar: me.data.avatarUrl ?? "",
      role: me.data.role ?? "ADMIN",
      permissions: me.data.permissions ?? [],
    };
  } catch (error) {
    if (error instanceof NestRequestError && error.status === 401) {
      return null;
    }
    return null;
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user) return user;

  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    const pathname = (await headers()).get("x-pathname") || "/dashboard";
    const next =
      pathname.startsWith("/") && !pathname.startsWith("//")
        ? pathname
        : "/dashboard";
    redirect(
      `${SESSION_REFRESH_PATH}?next=${encodeURIComponent(next)}`,
    );
  }

  if (await getAccessToken()) {
    redirect(SESSION_EXPIRED_PATH);
  }

  redirect("/sign-in");
}

export async function requirePermission(
  permission: string,
): Promise<SessionUser> {
  const user = await requireAuth();
  const permissions = user.permissions ?? [];
  if (!permissions.includes(permission)) {
    redirect("/errors/forbidden");
  }
  return user;
}

export async function getOptionalUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

/** @deprecated Use clearAuthCookies — kept for session-expired page */
export async function destroySession() {
  await clearAuthCookies();
}
