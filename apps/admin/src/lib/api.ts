"use client";

import type { AuthSession } from "./types";

const ACCESS_KEY = "hero_admin_access";
const REFRESH_KEY = "hero_admin_refresh";
const USER_KEY = "hero_admin_user";

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";
}

export function loadSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const accessToken = localStorage.getItem(ACCESS_KEY);
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  const userRaw = localStorage.getItem(USER_KEY);
  if (!accessToken || !refreshToken || !userRaw) return null;
  try {
    return { accessToken, refreshToken, user: JSON.parse(userRaw) };
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession) {
  localStorage.setItem(ACCESS_KEY, session.accessToken);
  localStorage.setItem(REFRESH_KEY, session.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

type ApiErrorBody = {
  error?: { message?: string; code?: string };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseError(response: Response) {
  let message = `Request failed (${response.status})`;
  let code: string | undefined;
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.error?.message) message = body.error.message;
    code = body.error?.code;
  } catch {
    // ignore
  }
  return new ApiError(message, response.status, code);
}

let refreshPromise: Promise<AuthSession | null> | null = null;

async function refreshSession(): Promise<AuthSession | null> {
  const current = loadSession();
  if (!current?.refreshToken) return null;
  const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  if (!response.ok) {
    clearSession();
    return null;
  }
  const body = (await response.json()) as {
    data: { accessToken: string; refreshToken: string; user: AuthSession["user"] };
  };
  if (body.data.user.role !== "ADMIN") {
    clearSession();
    return null;
  }
  const next: AuthSession = {
    accessToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
    user: body.data.user,
  };
  saveSession(next);
  return next;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("Content-Type") && rest.body) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (auth) {
    const session = loadSession();
    if (session?.accessToken) {
      requestHeaders.set("Authorization", `Bearer ${session.accessToken}`);
    }
  }

  let response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers: requestHeaders,
  });

  if (response.status === 401 && auth) {
    refreshPromise ??= refreshSession().finally(() => {
      refreshPromise = null;
    });
    const refreshed = await refreshPromise;
    if (!refreshed) throw new ApiError("Authentication required", 401, "UNAUTHORIZED");
    requestHeaders.set("Authorization", `Bearer ${refreshed.accessToken}`);
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...rest,
      headers: requestHeaders,
    });
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function adminLogin(email: string, password: string) {
  const body = await apiFetch<{
    data: { accessToken: string; refreshToken: string; user: AuthSession["user"] };
  }>("/admin/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email, password }),
  });
  const session: AuthSession = {
    accessToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
    user: body.data.user,
  };
  saveSession(session);
  return session;
}

export async function adminLogout() {
  const session = loadSession();
  if (session?.refreshToken) {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    } catch {
      // ignore logout errors
    }
  }
  clearSession();
}
