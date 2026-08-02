import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth/cookie-names";

/**
 * Clears JWT cookies whose session no longer resolves. Layouts cannot mutate
 * cookies, so without this hop the proxy would keep seeing a session cookie,
 * bounce the request back off `/sign-in`, and loop forever.
 */
export function GET(request: Request) {
  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("expired", "1");

  const response = NextResponse.redirect(signInUrl);
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}
