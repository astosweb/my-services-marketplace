import { describe, expect, it } from "vitest";
import { MemoryRateLimitStore } from "./rate-limit.js";

describe("MemoryRateLimitStore", () => {
  it("resets after the window expires", async () => {
    const store = new MemoryRateLimitStore();
    expect((await store.hit("window-reset", 20)).count).toBe(1);
    expect((await store.hit("window-reset", 20)).count).toBe(2);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect((await store.hit("window-reset", 20)).count).toBe(1);
  });

  it("counts hits in a fixed window", async () => {
    const local = new MemoryRateLimitStore();
    const first = await local.hit("k", 60_000);
    expect(first.count).toBe(1);
    const second = await local.hit("k", 60_000);
    expect(second.count).toBe(2);
    expect(second.retryAfterSec).toBeGreaterThan(0);
  });
});
