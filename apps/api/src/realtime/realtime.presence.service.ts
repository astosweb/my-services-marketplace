import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";
import { env } from "../lib/env.js";
import { getRateLimitStore, RedisRateLimitStore } from "../middleware/rate-limit.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { PRESENCE_TTL_MS } from "./realtime.constants.js";

type PresenceRecord = {
  sockets: Set<string>;
  lastSeenAt: Date;
};

/**
 * Tracks online users across sockets. Uses Redis SET+TTL when available so
 * presence is consistent across horizontally scaled API instances; falls back
 * to in-process maps for single-node / test environments.
 */
@Injectable()
export class RealtimePresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimePresenceService.name);
  private readonly local = new Map<string, PresenceRecord>();
  private redis: RedisClientType | null = null;
  private ownedRedis = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleDestroy() {
    if (this.ownedRedis && this.redis?.isOpen) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  private async redisClient(): Promise<RedisClientType | null> {
    if (this.redis?.isOpen) return this.redis;
    const store = getRateLimitStore();
    if (store instanceof RedisRateLimitStore) {
      this.redis = store.getClient();
      this.ownedRedis = false;
      return this.redis;
    }
    if (!env.REDIS_URL) return null;
    try {
      const client = createClient({ url: env.REDIS_URL }) as RedisClientType;
      await client.connect();
      this.redis = client;
      this.ownedRedis = true;
      return client;
    } catch (error) {
      this.logger.warn(`Presence Redis unavailable: ${String(error)}`);
      return null;
    }
  }

  private presenceKey(userId: string) {
    return `presence:online:${userId}`;
  }

  async connect(userId: string, socketId: string): Promise<{ becameOnline: boolean }> {
    const now = new Date();
    const local = this.local.get(userId) ?? { sockets: new Set<string>(), lastSeenAt: now };
    const becameOnline = local.sockets.size === 0;
    local.sockets.add(socketId);
    local.lastSeenAt = now;
    this.local.set(userId, local);

    const client = await this.redisClient();
    if (client) {
      await client.set(this.presenceKey(userId), now.toISOString(), { PX: PRESENCE_TTL_MS });
    }

    if (becameOnline) {
      await this.prisma.user
        .update({ where: { id: userId }, data: { lastSeenAt: now } })
        .catch((error) => this.logger.warn(`lastSeenAt update failed: ${String(error)}`));
    }

    return { becameOnline };
  }

  async disconnect(userId: string, socketId: string): Promise<{ becameOffline: boolean; lastSeenAt: Date }> {
    const now = new Date();
    const local = this.local.get(userId);
    if (local) {
      local.sockets.delete(socketId);
      local.lastSeenAt = now;
      if (local.sockets.size === 0) this.local.delete(userId);
      else this.local.set(userId, local);
    }

    const stillLocal = (this.local.get(userId)?.sockets.size ?? 0) > 0;
    const client = await this.redisClient();

    if (stillLocal) {
      if (client) {
        await client.set(this.presenceKey(userId), now.toISOString(), { PX: PRESENCE_TTL_MS });
      }
      return { becameOffline: false, lastSeenAt: now };
    }

    if (client) {
      await client.del(this.presenceKey(userId));
    }

    await this.prisma.user
      .update({ where: { id: userId }, data: { lastSeenAt: now } })
      .catch((error) => this.logger.warn(`lastSeenAt update failed: ${String(error)}`));

    return { becameOffline: true, lastSeenAt: now };
  }

  async heartbeat(userId: string) {
    const now = new Date();
    const local = this.local.get(userId);
    if (local) {
      local.lastSeenAt = now;
      this.local.set(userId, local);
    }
    const client = await this.redisClient();
    if (client) {
      await client.set(this.presenceKey(userId), now.toISOString(), { PX: PRESENCE_TTL_MS });
    }
  }

  async isOnline(userId: string): Promise<boolean> {
    const local = this.local.get(userId);
    if (local && local.sockets.size > 0) return true;
    const client = await this.redisClient();
    if (!client) return false;
    return Boolean(await client.exists(this.presenceKey(userId)));
  }

  async getLastSeenAt(userId: string): Promise<Date | null> {
    const local = this.local.get(userId);
    if (local) return local.lastSeenAt;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastSeenAt: true },
    });
    return user?.lastSeenAt ?? null;
  }
}
