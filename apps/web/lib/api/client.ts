export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: ApiFieldError[] = [],
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiFieldError = { field?: string; path?: string; message: string };

type QueryValue = string | number | boolean | null | undefined;

export function apiQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

type NestEnvelope<T> = {
  data?: T;
  meta?: Record<string, unknown>;
  success?: boolean;
  error?: string | { message?: string; code?: string };
  errors?: ApiFieldError[];
};

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST" })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function toPaginatedIfList<T>(payload: NestEnvelope<T>): T {
  if (payload.meta && Array.isArray(payload.data)) {
    const meta = payload.meta as {
      total?: number;
      limit?: number;
      offset?: number;
      unreadCount?: number;
    };
    const limit = meta.limit ?? 50;
    const offset = meta.offset ?? 0;
    const total = meta.total ?? (payload.data as unknown[]).length;
    const page = limit > 0 ? Math.floor(offset / limit) + 1 : 1;
    const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
    return {
      items: payload.data,
      meta: {
        ...meta,
        total,
        limit,
        offset,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    } as T;
  }
  return payload.data as T;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  didRefresh = false,
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 401 && !didRefresh && !path.startsWith("/auth/")) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, init, true);
    }
    if (typeof window !== "undefined") {
      window.location.href = "/session-expired";
    }
    throw new ApiError("Unauthorized", 401);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let payload: NestEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as NestEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!payload) {
    throw new ApiError(
      response.ok ? "Malformed response" : response.statusText,
      response.status,
    );
  }

  if (typeof payload.success === "boolean") {
    if (!payload.success) {
      const message =
        typeof payload.error === "string"
          ? payload.error
          : (payload.error?.message ?? "Request failed");
      throw new ApiError(message, response.status, payload.errors ?? []);
    }
    return payload.data as T;
  }

  if (!response.ok || ("error" in payload && payload.error && !("data" in payload))) {
    const message =
      typeof payload.error === "string"
        ? payload.error
        : (payload.error?.message ?? response.statusText ?? "Request failed");
    const code =
      typeof payload.error === "object" ? payload.error.code : undefined;
    throw new ApiError(message, response.status, payload.errors ?? [], code);
  }

  return toPaginatedIfList(payload);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", body: formData }),
};
