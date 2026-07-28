import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("health routes", () => {
  it("GET /health returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, service: "hero-api" });
  });

  it("unknown routes return NOT_FOUND", async () => {
    const res = await app.request("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const body = (await res.json()) as {
      error: { message: string; code: string; requestId?: string };
    };
    expect(body.error.message).toBe("Not found");
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBeTruthy();
  });
});
