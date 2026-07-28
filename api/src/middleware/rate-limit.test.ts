import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { onError } from "./on-error.js";
import {
  MemoryRateLimitStore,
  rateLimit,
  setRateLimitStoreForTests,
} from "./rate-limit.js";

describe("rate limit middleware", () => {
  const store = new MemoryRateLimitStore();

  beforeEach(() => {
    store.clear();
    setRateLimitStoreForTests(store);
  });

  afterEach(() => {
    store.clear();
  });

  it("allows requests under the limit and returns 429 after", async () => {
    const app = new Hono();
    app.onError(onError);
    app.post(
      "/login",
      rateLimit({
        limit: 3,
        windowMs: 60_000,
        readJsonBody: true,
        key: (c, body) => {
          const email = typeof body?.email === "string" ? body.email : "x";
          return `test:${c.req.header("x-forwarded-for") ?? "ip"}:${email}`;
        },
      }),
      (c) => c.json({ ok: true }),
    );

    const body = JSON.stringify({ email: "user@example.com" });
    const headers = {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    };

    for (let i = 0; i < 3; i++) {
      const res = await app.request("/login", { method: "POST", headers, body });
      expect(res.status).toBe(200);
    }

    const limited = await app.request("/login", { method: "POST", headers, body });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    await expect(limited.json()).resolves.toEqual({
      error: {
        message: "Too many requests. Please try again later.",
        code: "RATE_LIMITED",
      },
    });
  });

  it("resets after the window expires", async () => {
    const app = new Hono();
    app.onError(onError);
    app.get(
      "/ping",
      rateLimit({
        limit: 1,
        windowMs: 20,
        key: () => "window-reset",
      }),
      (c) => c.json({ ok: true }),
    );

    expect((await app.request("/ping")).status).toBe(200);
    expect((await app.request("/ping")).status).toBe(429);

    await new Promise((r) => setTimeout(r, 25));
    expect((await app.request("/ping")).status).toBe(200);
  });

  it("MemoryRateLimitStore counts hits in a fixed window", async () => {
    const local = new MemoryRateLimitStore();
    const first = await local.hit("k", 60_000);
    expect(first.count).toBe(1);
    const second = await local.hit("k", 60_000);
    expect(second.count).toBe(2);
    expect(second.retryAfterSec).toBeGreaterThan(0);
  });
});
