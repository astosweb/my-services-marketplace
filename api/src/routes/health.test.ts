import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("health routes", () => {
  it("GET /health returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, service: "davay-api" });
  });

  it("unknown routes return NOT_FOUND", async () => {
    const res = await app.request("/does-not-exist");
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: { message: "Not found", code: "NOT_FOUND" },
    });
  });
});
