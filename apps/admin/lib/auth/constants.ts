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

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_DURATION_MS = 60 * 60 * 1000;

export const LOGIN_RATE_LIMIT = { attempts: 5, windowSeconds: 300 };
export const LOGIN_IP_RATE_LIMIT = { attempts: 20, windowSeconds: 300 };
export const PASSWORD_RESET_RATE_LIMIT = { attempts: 5, windowSeconds: 3600 };

export const SESSION_EXPIRED_PATH = "/session-expired";
export const SESSION_REFRESH_PATH = "/session-refresh";

export const PUBLIC_ROUTES = [
  SESSION_EXPIRED_PATH,
  SESSION_REFRESH_PATH,
  "/sign-in",
  "/forgot-password",
  "/reset-password",
  "/errors/unauthorized",
  "/errors/forbidden",
  "/errors/not-found",
  "/errors/internal-server-error",
  "/errors/under-maintenance",
] as const;

export const AUTH_ROUTES = [
  "/sign-in",
  "/forgot-password",
] as const;
