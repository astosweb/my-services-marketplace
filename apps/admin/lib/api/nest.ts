import "server-only";

import { cookies } from "next/headers";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth/cookie-names";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

export type NestErrorBody = {
  error?: { message?: string; code?: string; requestId?: string };
};

export class NestRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "NestRequestError";
  }
}

type NestFetchOptions = RequestInit & {
  accessToken?: string | null;
  skipAuth?: boolean;
};

export async function nestFetch<T>(
  path: string,
  options: NestFetchOptions = {},
): Promise<T> {
  const { accessToken, skipAuth, headers, ...init } = options;
  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;

  let bearer = accessToken;
  if (!skipAuth && bearer === undefined) {
    const jar = await cookies();
    bearer = jar.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...headers,
    },
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/csv")) {
    return (await response.text()) as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const nestError = payload as NestErrorBody | null;
    throw new NestRequestError(
      nestError?.error?.message ?? response.statusText ?? "Request failed",
      response.status,
      nestError?.error?.code,
    );
  }

  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload
  ) {
    return payload as T;
  }

  return payload as T;
}

export async function getRefreshToken() {
  const jar = await cookies();
  return jar.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}

export async function getAccessToken() {
  const jar = await cookies();
  return jar.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export { API_URL };
