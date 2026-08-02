import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, apiQuery } from "@/lib/api/client";

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    statusText: "",
    headers: { get: () => "application/json" },
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiQuery", () => {
  it("drops empty and nullish parameters", () => {
    expect(
      apiQuery({
        page: 2,
        search: "",
        status: undefined,
        role: null,
        unread: true,
      }),
    ).toBe("?page=2&unread=true");
  });
});

describe("api", () => {
  it("unwraps Nest data envelope", async () => {
    mockFetch(200, { data: { id: "1" } });
    await expect(api.get<{ id: string }>("/admin/users/1")).resolves.toEqual({
      id: "1",
    });
  });

  it("maps Nest list+meta to Paginated", async () => {
    mockFetch(200, {
      data: [{ id: "1" }],
      meta: { total: 1, limit: 20, offset: 0 },
    });
    await expect(api.get("/admin/users")).resolves.toEqual({
      items: [{ id: "1" }],
      meta: {
        total: 1,
        limit: 20,
        offset: 0,
        page: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  });

  it("throws ApiError from Nest error envelope", async () => {
    mockFetch(400, {
      error: { message: "Bad request", code: "BAD_REQUEST" },
    });
    const error = await api.post("/admin/users", {}).catch((thrown) => thrown);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: "Bad request", status: 400 });
  });
});
