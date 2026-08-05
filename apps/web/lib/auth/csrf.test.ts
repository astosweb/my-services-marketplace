import { describe, expect, it } from "vitest";
import {
  assertSameOriginMutation,
  isProxyPathAllowed,
} from "./csrf";

describe("csrf helpers", () => {
  it("allows safe methods without origin", () => {
    const request = new Request("http://localhost:3002/api/requests", {
      method: "GET",
    });
    expect(assertSameOriginMutation(request)).toBeNull();
  });

  it("allows same-origin POST", () => {
    const request = new Request("http://localhost:3002/api/requests", {
      method: "POST",
      headers: {
        host: "localhost:3002",
        origin: "http://localhost:3002",
      },
    });
    expect(assertSameOriginMutation(request)).toBeNull();
  });

  it("rejects cross-origin POST", async () => {
    const request = new Request("http://localhost:3002/api/requests", {
      method: "POST",
      headers: {
        host: "localhost:3002",
        origin: "https://evil.example",
      },
    });
    const response = assertSameOriginMutation(request);
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "CSRF_REJECTED" },
    });
  });

  it("allowlists proxy prefixes", () => {
    expect(isProxyPathAllowed(["requests", "1"], ["requests", "users"])).toBe(
      true,
    );
    expect(isProxyPathAllowed(["admin", "users"], ["requests"])).toBe(false);
  });
});
