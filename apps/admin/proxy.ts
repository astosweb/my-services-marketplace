import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AUTH_ROUTES,
  PUBLIC_ROUTES,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/constants";

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname === "/register") {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (
    pathname === "/sign-up" ||
    pathname === "/sign-up-2" ||
    pathname === "/sign-up-3" ||
    pathname.startsWith("/sign-up/")
  ) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (pathname.startsWith("/auth/")) {
    const newPath = pathname.replace(/^\/auth/, "");
    return NextResponse.redirect(new URL(newPath || "/sign-in", request.url));
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const hasSession = Boolean(sessionToken);

  if (hasSession && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!hasSession && !isPublicRoute(pathname) && pathname !== "/") {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
