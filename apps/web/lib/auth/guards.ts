import "server-only";

import {
  nestFetch,
  NestRequestError,
  getAccessToken,
  getRefreshToken,
} from "@/lib/api/nest";
import type { MeUser } from "@monorepo/shared";
import { SESSION_REFRESH_PATH } from "@/lib/auth/constants";
import { redirect } from "next/navigation";

/** Best-effort session read for RSC. Expired access → redirect to refresh hop. */
export async function getSessionUser(): Promise<MeUser | null> {
  const accessToken = await getAccessToken();
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
  if (refreshToken) {
    // Cookie mutation is not allowed in RSC — bounce through refresh route.
    return null;
  }

  return null;
}

export async function requireAuth(callbackUrl = "/dashboard"): Promise<MeUser> {
  const accessToken = await getAccessToken();
  if (accessToken) {
    try {
      const me = await nestFetch<{ data: MeUser }>("/auth/me", {
        accessToken,
      });
      return me.data;
    } catch (error) {
      if (!(error instanceof NestRequestError) || error.status !== 401) {
        redirect(
          `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        );
      }
    }
  }

  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    redirect(
      `${SESSION_REFRESH_PATH}?callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );
  }

  redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
}
