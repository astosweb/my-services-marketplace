import { NextRequest, NextResponse } from "next/server";
import { nestFetch, getRefreshToken } from "@/lib/api/nest";
import {
  clearAuthCookies,
  setAuthCookies,
  authCookieBase,
} from "@/lib/auth/token-cookies";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth/cookie-names";

export async function GET(request: NextRequest) {
  const callbackUrl =
    request.nextUrl.searchParams.get("callbackUrl") || "/dashboard";
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    await clearAuthCookies();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const result = await nestFetch<{
      data: { accessToken: string; refreshToken: string };
    }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    });

    const response = NextResponse.redirect(new URL(callbackUrl, request.url));
    const base = authCookieBase();
    response.cookies.set(ACCESS_TOKEN_COOKIE, result.data.accessToken, {
      ...base,
      maxAge: 60 * 15,
    });
    response.cookies.set(REFRESH_TOKEN_COOKIE, result.data.refreshToken, {
      ...base,
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch {
    await clearAuthCookies();
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
