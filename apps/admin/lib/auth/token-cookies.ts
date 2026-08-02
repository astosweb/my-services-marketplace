import { cookies } from "next/headers";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth/cookie-names";

const isProd = process.env.NODE_ENV === "production";

const baseCookie = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
};

/** Access JWT ~15m; refresh ~30d — match Nest defaults. */
export async function setAuthCookies(tokens: {
  accessToken: string;
  refreshToken: string;
}) {
  const jar = await cookies();
  jar.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseCookie,
    maxAge: 60 * 15,
  });
  jar.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseCookie,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_TOKEN_COOKIE);
  jar.delete(REFRESH_TOKEN_COOKIE);
}
