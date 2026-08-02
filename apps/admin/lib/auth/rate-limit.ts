import "server-only";

import { headers } from "next/headers";
import { getRedis } from "@/lib/redis";

export type RateLimitVerdict = {
  allowed: boolean;
  retryAfterSeconds: number;
};

/**
 * Fallback bucket store for deployments without Redis. Single-process only, so
 * treat Redis as required for horizontally scaled environments.
 */
const memoryBuckets = new Map<string, { count: number; expiresAt: number }>();

function consumeInMemory(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitVerdict {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || bucket.expiresAt <= now) {
    memoryBuckets.set(key, {
      count: 1,
      expiresAt: now + windowSeconds * 1000,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  return bucket.count > limit
    ? {
        allowed: false,
        retryAfterSeconds: Math.ceil((bucket.expiresAt - now) / 1000),
      }
    : { allowed: true, retryAfterSeconds: 0 };
}

let warnedAboutMemoryStore = false;

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitVerdict> {
  const redis = await getRedis();
  if (!redis) {
    if (!warnedAboutMemoryStore && process.env.NODE_ENV === "production") {
      warnedAboutMemoryStore = true;
      console.warn(
        "[rate-limit] REDIS_URL is unset: brute-force limits are per-process only and will not hold across instances.",
      );
    }
    return consumeInMemory(key, limit, windowSeconds);
  }

  const namespaced = `ratelimit:${key}`;
  const count = await redis.incr(namespaced);
  if (count === 1) {
    await redis.expire(namespaced, windowSeconds);
  }
  if (count <= limit) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const ttl = await redis.ttl(namespaced);
  return {
    allowed: false,
    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    await redis.del(`ratelimit:${key}`);
    return;
  }
  memoryBuckets.delete(key);
}

/**
 * Forwarding headers are client-controlled unless a proxy we trust rewrites
 * them, so without `TRUST_PROXY` there is no usable client IP and callers fall
 * back to the identifier-scoped limits, which cannot be spoofed.
 */
export async function clientIp(): Promise<string | null> {
  if (process.env.TRUST_PROXY !== "true" && process.env.TRUST_PROXY !== "1") {
    return null;
  }

  const headerStore = await headers();
  return (
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null
  );
}
