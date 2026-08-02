import "server-only";

import { createClient, type RedisClientType } from "redis";

const globalForRedis = globalThis as typeof globalThis & {
  redis?: RedisClientType;
  redisConnect?: Promise<RedisClientType | null>;
};

function createRedisClient(): RedisClientType | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const client = createClient({ url });
  client.on("error", (error) => {
    console.error("[redis]", error);
  });
  return client;
}

export async function getRedis(): Promise<RedisClientType | null> {
  if (!globalForRedis.redis) {
    globalForRedis.redis = createRedisClient() ?? undefined;
  }

  const client = globalForRedis.redis;
  if (!client) return null;

  if (!client.isOpen) {
    globalForRedis.redisConnect ??= client.connect().then(
      () => client,
      (error: unknown) => {
        console.error("[redis] connect failed", error);
        globalForRedis.redisConnect = undefined;
        return null;
      },
    );
    return globalForRedis.redisConnect;
  }

  return client;
}
