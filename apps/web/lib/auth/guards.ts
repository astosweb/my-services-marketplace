import { cookies } from "next/headers";
import {
  nestFetch,
  NestRequestError,
  getAccessToken,
  getRefreshToken,
} from "@/lib/api/nest";
import {
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/auth/token-cookies";
import type { MeUser } from "@monorepo/shared";
import { SESSION_REFRESH_PATH } from "@/lib/auth/constants";
import { redirect } from "next/navigation";

export async function getSessionUser(): Promise<MeUser | null> {
  try {
    let accessToken = await getAccessToken();
    if (accessToken) {
      try {
        const me = await nestFetch<{ data: MeUser }>("/auth/me", {
          accessToken,
        });
        return me.data;
      } catch (error) {
        if (!(error instanceof NestRequestError) || error.status !== 401) {
          return null;
        }
      }
    }

    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    // RSC cannot mutate cookies — bounce through refresh hop
    const jar = await cookies();
    if (!jar.get("web_access_token")?.value && refreshToken) {
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function requireAuth(callbackUrl?: string): Promise<MeUser> {
  const user = await getSessionUser();
  if (user) return user;

  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    const target = callbackUrl ?? "/dashboard";
    redirect(
      `${SESSION_REFRESH_PATH}?callbackUrl=${encodeURIComponent(target)}`,
    );
  }

  redirect(
    `/login?callbackUrl=${encodeURIComponent(callbackUrl ?? "/dashboard")}`,
  );
}

export async function refreshAndSetCookies() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await clearAuthCookies();
    return false;
  }
  try {
    const result = await nestFetch<{
      data: { accessToken: string; refreshToken: string };
    }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    });
    await setAuthCookies({
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
    });
    return true;
  } catch {
    await clearAuthCookies();
    return false;
  }
}
