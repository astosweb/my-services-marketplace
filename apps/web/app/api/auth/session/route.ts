import { NextResponse } from "next/server";
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

type NestMePayload = { data: MeUser };
type NestRefreshPayload = {
  data: {
    user: MeUser;
    accessToken: string;
    refreshToken: string;
  };
};

async function fetchMe(accessToken: string) {
  return nestFetch<NestMePayload>("/auth/me", { accessToken });
}

async function tryRefresh() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  const result = await nestFetch<NestRefreshPayload>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
    skipAuth: true,
  });
  await setAuthCookies({
    accessToken: result.data.accessToken,
    refreshToken: result.data.refreshToken,
  });
  return result.data;
}

export async function GET() {
  try {
    let accessToken = await getAccessToken();
    let me: MeUser | null = null;

    if (accessToken) {
      try {
        me = (await fetchMe(accessToken)).data;
      } catch (error) {
        if (!(error instanceof NestRequestError) || error.status !== 401) {
          throw error;
        }
      }
    }

    if (!me) {
      const refreshed = await tryRefresh();
      if (!refreshed) {
        await clearAuthCookies();
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        );
      }
      accessToken = refreshed.accessToken;
      me = (await fetchMe(accessToken)).data;
    }

    return NextResponse.json({
      success: true,
      data: { user: me },
    });
  } catch (error) {
    if (error instanceof NestRequestError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: "Session lookup failed" },
      { status: 500 },
    );
  }
}
