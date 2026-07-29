import type { AuthPayload, Category, PageMeta, ServiceRequest, User } from "./types";

const fallbackApiUrl = "http://localhost:3000";

export function getApiBaseUrl() {
  if (typeof window === "undefined") {
    return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? fallbackApiUrl;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? fallbackApiUrl;
}

export class ApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type Envelope<T> = { data: T };
type Paginated<T> = { data: T; meta: PageMeta };

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as
    | T
    | { error?: { message?: string; code?: string } }
    | null;
  if (!res.ok) {
    const err = body as { error?: { message?: string; code?: string } } | null;
    throw new ApiError(err?.error?.message ?? `Request failed (${res.status})`, res.status, err?.error?.code);
  }
  return body as T;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string | null },
): Promise<T> {
  const { token, headers, ...rest } = init ?? {};
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: "no-store",
  });
  return parseJson<T>(res);
}

export async function listRequests(params?: {
  city?: string;
  categoryId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ requests: ServiceRequest[]; meta: PageMeta }> {
  const search = new URLSearchParams();
  if (params?.city) search.set("city", params.city);
  if (params?.categoryId) search.set("categoryId", params.categoryId);
  if (params?.status) search.set("status", params.status);
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  const payload = await apiFetch<Paginated<ServiceRequest[]>>(`/requests${qs ? `?${qs}` : ""}`);
  return { requests: payload.data, meta: payload.meta };
}

export async function getRequest(id: string, token?: string | null): Promise<ServiceRequest> {
  const payload = await apiFetch<Envelope<ServiceRequest>>(`/requests/${id}`, { token });
  return payload.data;
}

export async function listCategories(): Promise<Category[]> {
  const payload = await apiFetch<Envelope<Category[]>>("/categories");
  return payload.data;
}

export async function login(email: string, password: string): Promise<AuthPayload> {
  const payload = await apiFetch<Envelope<AuthPayload>>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return payload.data;
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthPayload> {
  const payload = await apiFetch<Envelope<AuthPayload>>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });
  return payload.data;
}

export async function forgotPassword(email: string): Promise<{ message: string; token?: string; resetLink?: string }> {
  const payload = await apiFetch<Envelope<{ message: string; token?: string; resetLink?: string }>>(
    "/auth/forgot-password",
    { method: "POST", body: JSON.stringify({ email }) },
  );
  return payload.data;
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await apiFetch("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function getMe(token: string): Promise<User> {
  const payload = await apiFetch<Envelope<User>>("/auth/me", { token });
  return payload.data;
}

export async function createRequest(
  token: string,
  body: {
    categoryId: string;
    title: string;
    description: string;
    city: string;
    latitude: number;
    longitude: number;
    location: string;
    budgetCents?: number;
    budgetLabel?: string;
    pricingMode?: string;
  },
): Promise<ServiceRequest> {
  const payload = await apiFetch<Envelope<ServiceRequest>>("/requests", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
  return payload.data;
}

/** Demo requests used when the API is unreachable (landing still looks alive). */
export const demoRequests: ServiceRequest[] = [
  {
    id: "demo_plumbing",
    categoryId: "plumbing",
    categoryName: "Plumbing",
    categorySymbol: "drop.fill",
    title: "Leaking pipe under kitchen sink",
    description:
      "Water dripping from the U-bend, needs replacing or sealing. Preferably done today.",
    city: "Tallinn",
    latitude: 59.449,
    longitude: 24.7356,
    location: "Tallinn, Kristiine",
    budgetCents: null,
    budget: "€30–60",
    scheduledAt: null,
    pricingMode: "PROVIDER_OFFERS",
    status: "OPEN",
    progressStatus: null,
    progressUpdatedAt: null,
    completedAt: null,
    cancelledAt: null,
    isPremium: false,
    offerCount: 3,
    viewCount: 18,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    photos: [],
    requester: {
      id: "demo_moonika",
      displayName: "Moonika Tamm",
      bio: null,
      avatarUrl: null,
      rating: 4.2,
      reviewCount: 8,
      memberSince: "2024-01-01T00:00:00.000Z",
    },
    acceptedOffer: null,
    viewerOffer: null,
  },
  {
    id: "demo_electrical",
    categoryId: "electrical",
    categoryName: "Electrical",
    categorySymbol: "bolt.fill",
    title: "Install 3 ceiling light fixtures",
    description:
      "New apartment, wiring is ready. Need an electrician to mount and connect three pendant lights.",
    city: "Tallinn",
    latitude: 59.4462,
    longitude: 24.6975,
    location: "Tallinn, Põhja-Tallinn",
    budgetCents: null,
    budget: "€80–120",
    scheduledAt: null,
    pricingMode: "PROVIDER_OFFERS",
    status: "IN_PROGRESS",
    progressStatus: "STARTED",
    progressUpdatedAt: null,
    completedAt: null,
    cancelledAt: null,
    isPremium: true,
    offerCount: 5,
    viewCount: 42,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    photos: [],
    requester: {
      id: "demo_raivo",
      displayName: "Raivo Kaljurand",
      bio: null,
      avatarUrl: null,
      rating: 4.8,
      reviewCount: 24,
      memberSince: "2023-06-01T00:00:00.000Z",
    },
    acceptedOffer: null,
    viewerOffer: null,
  },
  {
    id: "demo_cleaning",
    categoryId: "cleaning",
    categoryName: "Cleaning",
    categorySymbol: "sparkles",
    title: "Post-renovation deep clean",
    description: "3-room apartment after renovation. Dust, paint spots everywhere. ~65 m².",
    city: "Tartu",
    latitude: 58.371,
    longitude: 26.72,
    location: "Tartu, Annelinn",
    budgetCents: null,
    budget: "€100–150",
    scheduledAt: null,
    pricingMode: "PROVIDER_OFFERS",
    status: "OPEN",
    progressStatus: null,
    progressUpdatedAt: null,
    completedAt: null,
    cancelledAt: null,
    isPremium: false,
    offerCount: 2,
    viewCount: 25,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    photos: [],
    requester: {
      id: "demo_siiri",
      displayName: "Siiri Leppänen",
      bio: null,
      avatarUrl: null,
      rating: 4.5,
      reviewCount: 12,
      memberSince: "2024-03-01T00:00:00.000Z",
    },
    acceptedOffer: null,
    viewerOffer: null,
  },
];

export async function listRequestsSafe(params?: {
  city?: string;
  limit?: number;
}): Promise<{ requests: ServiceRequest[]; meta: PageMeta; fromDemo: boolean }> {
  try {
    const result = await listRequests({ ...params, status: "OPEN", limit: params?.limit ?? 12 });
    if (result.requests.length === 0) {
      return {
        requests: demoRequests,
        meta: { total: demoRequests.length, limit: demoRequests.length, offset: 0 },
        fromDemo: true,
      };
    }
    return { ...result, fromDemo: false };
  } catch {
    return {
      requests: demoRequests,
      meta: { total: demoRequests.length, limit: demoRequests.length, offset: 0 },
      fromDemo: true,
    };
  }
}
