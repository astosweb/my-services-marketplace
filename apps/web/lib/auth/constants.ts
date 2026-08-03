import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/cookie-names";

export {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_COOKIE_NAME,
};

export const SESSION_EXPIRED_PATH = "/session-expired";
export const SESSION_REFRESH_PATH = "/session-refresh";

/** Routes that never require auth (landing + marketing + auth forms). */
export const PUBLIC_ROUTES = [
  "/",
  SESSION_EXPIRED_PATH,
  SESSION_REFRESH_PATH,
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/explore",
  "/search",
  "/categories",
  "/requests",
  "/providers",
  "/how-it-works",
  "/faq",
] as const;

/** Auth pages — redirect away when already signed in. */
export const AUTH_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
] as const;

/** Must be signed in to visit. */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/favorites",
  "/notifications",
  "/messages",
  "/profile",
  "/settings",
  "/requests/new",
] as const;
