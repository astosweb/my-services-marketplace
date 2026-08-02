import {
  getAccessToken,
  getRefreshToken,
  nestFetch,
} from "@/lib/api/nest";
import {
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/auth/token-cookies";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

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
        user: { role?: string };
        accessToken: string;
        refreshToken: string;
      };
    }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    });
    if (result.data.user.role !== "ADMIN") {
      await clearAuthCookies();
      return null;
    }
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
