import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AUTH_ROUTES,
  PROTECTED_PREFIXES,
  PUBLIC_ROUTES,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/constants";

function matchesPrefix(pathname: string, routes: readonly string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isPublicRoute(pathname: string) {
  if (matchesPrefix(pathname, PUBLIC_ROUTES)) return true;
  // Public request detail pages except /requests/new
  if (pathname.startsWith("/requests/") && pathname !== "/requests/new") {
    return true;
  }
  return false;
}

function isProtectedRoute(pathname: string) {
  return matchesPrefix(pathname, PROTECTED_PREFIXES);
}

function isAuthRoute(pathname: string) {
  return matchesPrefix(pathname, AUTH_ROUTES);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );

  if (hasSession && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!hasSession && isProtectedRoute(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Soft public: allow browsing without session
  if (!hasSession && !isPublicRoute(pathname) && isProtectedRoute(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
