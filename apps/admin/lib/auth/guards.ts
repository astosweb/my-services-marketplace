import "server-only";

import { redirect } from "next/navigation";
import {
  getAccessToken,
  getRefreshToken,
  nestFetch,
  NestRequestError,
} from "@/lib/api/nest";
import {
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/auth/token-cookies";
import { SESSION_EXPIRED_PATH } from "@/lib/auth/constants";
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

async function refreshIfNeeded(): Promise<string | null> {
  const access = await getAccessToken();
  if (access) return access;

  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const result = await nestFetch<{
      data: {
        user: { role?: string };
        accessToken: string;
        refreshToken: string;
      };
    }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    });
    if (result.data.user.role !== "ADMIN") {
      await clearAuthCookies();
      return null;
    }
    await setAuthCookies({
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
    });
    return result.data.accessToken;
  } catch {
    await clearAuthCookies();
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const accessToken = await refreshIfNeeded();
  if (!accessToken) return null;

  try {
    const me = await nestFetch<NestMe>("/auth/me", { accessToken });
    if (me.data.role !== "ADMIN") {
      await clearAuthCookies();
      return null;
    }
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
      await clearAuthCookies();
    }
    return null;
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(SESSION_EXPIRED_PATH);
  }
  return user;
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
