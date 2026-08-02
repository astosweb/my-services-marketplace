import "server-only";

import { getRedis } from "@/lib/redis";
import type { SessionUser } from "@/lib/auth/types";

const SESSION_KEY_PREFIX = "session:";

export type CachedSession = {
  user: SessionUser;
  expiresAt: string;
};

export function sessionCacheKey(token: string): string {
  return `${SESSION_KEY_PREFIX}${token}`;
}

export async function getCachedSession(
  token: string,
): Promise<CachedSession | null> {
  const redis = await getRedis();
  if (!redis) return null;

  const raw = await redis.get(sessionCacheKey(token));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CachedSession;
  } catch {
    await redis.del(sessionCacheKey(token));
    return null;
  }
}

export async function setCachedSession(
  token: string,
  user: SessionUser,
  expiresAt: Date,
): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  const ttlSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  if (ttlSeconds <= 0) return;

  const payload: CachedSession = {
    user,
    expiresAt: expiresAt.toISOString(),
  };
  await redis.set(sessionCacheKey(token), JSON.stringify(payload), {
    EX: ttlSeconds,
  });
}

export async function deleteCachedSession(token: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  await redis.del(sessionCacheKey(token));
}

export async function deleteCachedSessions(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const redis = await getRedis();
  if (!redis) return;
  await redis.del(tokens.map(sessionCacheKey));
}
