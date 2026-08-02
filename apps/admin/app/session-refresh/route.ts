import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth/cookie-names";
import { SESSION_EXPIRED_PATH } from "@/lib/auth/constants";
import { authCookieBase } from "@/lib/auth/token-cookies";

type NestRefreshPayload = {
  data: {
    user: { role?: string };
    accessToken: string;
    refreshToken: string;
  };
};

const API_URL = process.env.API_URL ?? "http://localhost:3000";

/**
 * Layouts cannot mutate cookies, and Nest rotates refresh tokens on use.
 * When RSC auth sees a refresh cookie but no usable access token, it hops here
 * so cookies can be rewritten, then returns the user to the original page.
 */
export async function GET(request: NextRequest) {
  const rawNext = request.nextUrl.searchParams.get("next") || "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.redirect(new URL(SESSION_EXPIRED_PATH, request.url));
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.redirect(new URL(SESSION_EXPIRED_PATH, request.url));
    }

    const payload = (await response.json()) as NestRefreshPayload;
    if (payload.data.user.role !== "ADMIN") {
      return NextResponse.redirect(new URL(SESSION_EXPIRED_PATH, request.url));
    }

    const base = authCookieBase();
    const redirectResponse = NextResponse.redirect(new URL(next, request.url));
    redirectResponse.cookies.set(ACCESS_TOKEN_COOKIE, payload.data.accessToken, {
      ...base,
      maxAge: 60 * 15,
    });
    redirectResponse.cookies.set(
      REFRESH_TOKEN_COOKIE,
      payload.data.refreshToken,
      {
        ...base,
        maxAge: 60 * 60 * 24 * 30,
      },
    );
    return redirectResponse;
  } catch {
    return NextResponse.redirect(new URL(SESSION_EXPIRED_PATH, request.url));
  }
}
