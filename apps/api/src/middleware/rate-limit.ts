import type { Context, MiddlewareHandler, Next } from "hono";
import { createClient, type RedisClientType } from "redis";
import { env } from "../lib/env.js";
import { tooManyRequests } from "../lib/errors.js";

export type RateLimitStore = {
  /** Increment key in window; returns count after increment and seconds until window reset. */
  hit(key: string, windowMs: number): Promise<{ count: number; retryAfterSec: number }>;
  close?(): Promise<void>;
};

type MemoryEntry = { count: number; resetAt: number };

/** Fixed-window counter store for single-node / tests. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, MemoryEntry>();

  async hit(key: string, windowMs: number) {
    const now = Date.now();
    const existing = this.entries.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      this.entries.set(key, { count: 1, resetAt });
      return { count: 1, retryAfterSec: Math.ceil(windowMs / 1000) };
    }
    existing.count += 1;
    return {
      count: existing.count,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  /** Test helper: clear all counters. */
  clear() {
    this.entries.clear();
  }
}

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly client: RedisClientType) {}

  static async connect(url: string) {
    const client = createClient({ url }) as RedisClientType;
    client.on("error", (err) => {
      console.error("Redis rate-limit error:", err);
    });
    await client.connect();
    return new RedisRateLimitStore(client);
  }

  async hit(key: string, windowMs: number) {
    const redisKey = `rl:${key}`;
    const count = await this.client.incr(redisKey);
    if (count === 1) {
      await this.client.pExpire(redisKey, windowMs);
    }
    const pttl = await this.client.pTTL(redisKey);
    const retryAfterSec = Math.max(1, Math.ceil((pttl > 0 ? pttl : windowMs) / 1000));
    return { count, retryAfterSec };
  }

  async close() {
    await this.client.quit();
  }
}

let sharedStore: RateLimitStore | null = null;

export function getRateLimitStore() {
  if (!sharedStore) {
    if (env.NODE_ENV === "production" && !env.RATE_LIMIT_ALLOW_MEMORY && !env.REDIS_URL) {
      throw new Error(
        "REDIS_URL is required in production for rate limiting. Set RATE_LIMIT_ALLOW_MEMORY=true only for single-node deployments that accept in-memory limits.",
      );
    }
    sharedStore = new MemoryRateLimitStore();
  }
  return sharedStore;
}

/** For tests: inject a store without Redis. */
export function setRateLimitStoreForTests(store: RateLimitStore) {
  sharedStore = store;
}

export async function initRateLimitStore() {
  if (env.REDIS_URL) {
    sharedStore = await RedisRateLimitStore.connect(env.REDIS_URL);
    return sharedStore;
  }

  if (env.NODE_ENV === "production" && !env.RATE_LIMIT_ALLOW_MEMORY) {
    throw new Error(
      "REDIS_URL is required in production for rate limiting. Set RATE_LIMIT_ALLOW_MEMORY=true only for single-node deployments that accept in-memory limits.",
    );
  }

  sharedStore = new MemoryRateLimitStore();
  return sharedStore;
}

export function clientIp(c: Context) {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return c.req.header("x-real-ip")?.trim() || "unknown";
}

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  /** Build bucket key; return null to skip limiting. */
  key: (c: Context, body: Record<string, unknown> | null) => string | null | Promise<string | null>;
  /** When true, attempt to parse JSON body for keying (auth routes). */
  readJsonBody?: boolean;
};

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    let body: Record<string, unknown> | null = null;
    if (options.readJsonBody) {
      try {
        const cloned = c.req.raw.clone();
        const parsed: unknown = await cloned.json();
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          body = parsed as Record<string, unknown>;
        }
      } catch {
        body = null;
      }
    }

    const key = await options.key(c, body);
    if (!key) {
      await next();
      return;
    }

    const store = getRateLimitStore();
    const { count, retryAfterSec } = await store.hit(key, options.windowMs);
    c.header("X-RateLimit-Limit", String(options.limit));
    c.header("X-RateLimit-Remaining", String(Math.max(0, options.limit - count)));

    if (count > options.limit) {
      c.header("Retry-After", String(retryAfterSec));
      throw tooManyRequests("Too many requests. Please try again later.");
    }

    await next();
  };
}

const ONE_MINUTE = 60_000;

export const authCredentialRateLimit = rateLimit({
  limit: 5,
  windowMs: ONE_MINUTE,
  readJsonBody: true,
  key: (c, body) => {
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "unknown-email";
    return `auth:${clientIp(c)}:${email}`;
  },
});

export const refreshRateLimit = rateLimit({
  limit: 30,
  windowMs: ONE_MINUTE,
  key: (c) => `refresh:${clientIp(c)}`,
});

export const viewRateLimit = rateLimit({
  limit: 10,
  windowMs: ONE_MINUTE,
  key: (c) => `views:${clientIp(c)}:${c.req.param("id") ?? "unknown"}`,
});
