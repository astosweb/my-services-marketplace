import { NextResponse } from "next/server";
import { nestFetch, NestRequestError, getRefreshToken } from "@/lib/api/nest";
import {
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/auth/token-cookies";

type NestRefreshPayload = {
  data: {
    user: { role?: string };
    accessToken: string;
    refreshToken: string;
  };
};

export async function POST() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await clearAuthCookies();
    return NextResponse.json(
      { success: false, error: "No refresh token" },
      { status: 401 },
    );
  }

  try {
    const result = await nestFetch<NestRefreshPayload>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    });

    if (result.data.user.role !== "ADMIN") {
      await clearAuthCookies();
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 },
      );
    }

    await setAuthCookies({
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
    });

    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    await clearAuthCookies();
    if (error instanceof NestRequestError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: "Refresh failed" },
      { status: 500 },
    );
  }
}
