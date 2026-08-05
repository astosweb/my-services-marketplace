import { describe, expect, it } from "vitest";
import {
  assertSameOriginMutation,
  isProxyPathAllowed,
} from "./csrf";

describe("admin csrf helpers", () => {
  it("rejects cross-origin DELETE", async () => {
    const request = new Request("http://localhost:3001/api/admin/users/1", {
      method: "DELETE",
      headers: {
        host: "localhost:3001",
        origin: "https://evil.example",
      },
    });
    const response = assertSameOriginMutation(request);
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "CSRF_REJECTED" },
    });
  });

  it("allowlists admin prefixes", () => {
    expect(isProxyPathAllowed(["admin"], ["admin", "notifications"])).toBe(
      true,
    );
    expect(isProxyPathAllowed(["requests"], ["admin"])).toBe(false);
  });
});
