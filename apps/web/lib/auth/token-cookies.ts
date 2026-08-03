import { cookies } from "next/headers";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth/cookie-names";

export function authCookieBase() {
  const secure =
    process.env.COOKIE_SECURE === "true"
      ? true
      : process.env.COOKIE_SECURE === "false"
        ? false
        : process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function setAuthCookies(tokens: {
  accessToken: string;
  refreshToken: string;
}) {
  const jar = await cookies();
  const base = authCookieBase();
  jar.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: 60 * 15,
  });
  jar.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_TOKEN_COOKIE);
  jar.delete(REFRESH_TOKEN_COOKIE);
}
