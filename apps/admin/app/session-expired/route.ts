import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth/cookie-names";

/**
 * Clears JWT cookies whose session no longer resolves. Layouts cannot mutate
 * cookies, so without this hop the proxy would keep seeing a session cookie,
 * bounce the request back off `/sign-in`, and loop forever.
 *
 * Clear both Secure and non-Secure variants — Docker may have flipped
 * COOKIE_SECURE between deploys, and browsers match on that flag.
 */
export function GET(request: Request) {
  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("expired", "1");

  const response = NextResponse.redirect(signInUrl);
  for (const secure of [true, false]) {
    const base = {
      httpOnly: true,
      secure,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
    };
    response.cookies.set(ACCESS_TOKEN_COOKIE, "", base);
    response.cookies.set(REFRESH_TOKEN_COOKIE, "", base);
  }
  return response;
}
