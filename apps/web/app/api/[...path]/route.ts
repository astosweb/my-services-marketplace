import {
  getAccessToken,
  getRefreshToken,
  nestFetch,
} from "@/lib/api/nest";
import {
  assertSameOriginMutation,
  isProxyPathAllowed,
} from "@/lib/auth/csrf";
import {
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/auth/token-cookies";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

/** Nest paths the web BFF may forward (auth login/session use dedicated routes). */
const ALLOWED_PREFIXES = [
  "categories",
  "requests",
  "users",
  "conversations",
  "notifications",
  "uploads",
  "devices",
  "support",
  "auth",
];

type RouteContext = { params: Promise<{ path: string[] }> };

async function ensureAccessToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh) {
    const existing = await getAccessToken();
    if (existing) return existing;
  }

  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const result = await nestFetch<{
      data: {
        accessToken: string;
        refreshToken: string;
      };
    }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    });
    await setAuthCookies({
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
    });
    return result.data.accessToken;
  } catch {
    await clearAuthCookies();
    return null;
  }
}

async function proxy(request: Request, path: string[]) {
  const csrf = assertSameOriginMutation(request);
  if (csrf) return csrf;

  if (!isProxyPathAllowed(path, ALLOWED_PREFIXES)) {
    return Response.json(
      { error: { message: "Path not allowed", code: "PROXY_PATH_DENIED" } },
      { status: 404 },
    );
  }

  // Dedicated Next auth routes own these; block accidental Nest forwarding of session helpers.
  if (path[0] === "auth" && path[1] && !["me"].includes(path[1])) {
    return Response.json(
      { error: { message: "Path not allowed", code: "PROXY_PATH_DENIED" } },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const targetPath = `/${path.join("/")}${url.search}`;
  const accessToken = await ensureAccessToken();

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let response = await fetch(`${API_URL}${targetPath}`, init);

  if (response.status === 401 && (await getRefreshToken())) {
    const refreshed = await ensureAccessToken(true);
    if (refreshed) {
      headers.set("Authorization", `Bearer ${refreshed}`);
      response = await fetch(`${API_URL}${targetPath}`, { ...init, headers });
    }
  }

  const responseHeaders = new Headers();
  for (const key of ["content-type", "content-disposition"]) {
    const value = response.headers.get(key);
    if (value) responseHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PUT(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}
