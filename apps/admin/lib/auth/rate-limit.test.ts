import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("@/lib/redis", () => ({ getRedis: () => Promise.resolve(null) }));

const { consumeRateLimit, resetRateLimit } = await import(
  "@/lib/auth/rate-limit"
);

describe("consumeRateLimit (in-memory fallback)", () => {
  beforeEach(async () => {
    await resetRateLimit("spec");
  });

  it("allows requests up to the limit", async () => {
    const verdicts = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      verdicts.push(await consumeRateLimit("spec", 3, 60));
    }

    expect(verdicts.every((verdict) => verdict.allowed)).toBe(true);
  });

  it("blocks and reports a retry delay once the limit is exceeded", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await consumeRateLimit("spec", 3, 60);
    }

    const blocked = await consumeRateLimit("spec", 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("clears the bucket on reset so a successful sign-in is not punished", async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await consumeRateLimit("spec", 3, 60);
    }
    await resetRateLimit("spec");

    expect(await consumeRateLimit("spec", 3, 60)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });
});
