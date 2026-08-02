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

type NestMePayload = {
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

type NestRefreshPayload = {
  data: {
    user: NestMePayload["data"] & { role?: string };
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
  if (result.data.user.role !== "ADMIN") {
    await clearAuthCookies();
    return null;
  }
  await setAuthCookies({
    accessToken: result.data.accessToken,
    refreshToken: result.data.refreshToken,
  });
  return result.data;
}

export async function GET() {
  try {
    let accessToken = await getAccessToken();
    let me: NestMePayload["data"] | null = null;

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

    if (me.role !== "ADMIN") {
      await clearAuthCookies();
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: me.id,
          email: me.email,
          name: me.profileName ?? me.displayName,
          displayName: me.displayName,
          avatar: me.avatarUrl ?? "",
          role: me.role,
        },
        permissions: me.permissions ?? [],
      },
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
