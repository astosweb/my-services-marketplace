import {
  applyDecorators,
  CanActivate,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  SetMetadata,
  UseGuards,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
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
  private lastSweepAt = Date.now();

  private sweep(now: number) {
    if (now - this.lastSweepAt < 60_000) return;
    this.lastSweepAt = now;
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }

  async hit(key: string, windowMs: number) {
    const now = Date.now();
    this.sweep(now);
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

const RATE_LIMIT_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local pttl = redis.call('PTTL', KEYS[1])
return {count, pttl}
`;

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly client: RedisClientType) {}

  static async connect(url: string) {
    const client = createClient({ url }) as RedisClientType;
    await client.connect();
    return new RedisRateLimitStore(client);
  }

  /** Expose client for readiness probes / shared Redis usage. */
  getClient() {
    return this.client;
  }

  async hit(key: string, windowMs: number) {
    const redisKey = `rl:${key}`;
    const result = (await this.client.eval(RATE_LIMIT_LUA, {
      keys: [redisKey],
      arguments: [String(windowMs)],
    })) as [number, number];
    const count = Number(result[0]);
    const pttl = Number(result[1]);
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

export function clientIp(request: Request) {
  const forwarded = request.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.header("x-real-ip")?.trim() || request.ip || "unknown";
}

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  key: (request: Request) => string;
};

const ONE_MINUTE = 60_000;
const RATE_LIMIT_METADATA = "rate-limit";

const credentialRateLimit: RateLimitOptions = {
  limit: 5,
  windowMs: ONE_MINUTE,
  key: (request) => {
    const body = request.body as { email?: unknown } | undefined;
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "unknown-email";
    return `auth:${clientIp(request)}:${email}`;
  },
};

const refreshRateLimit: RateLimitOptions = {
  limit: 30,
  windowMs: ONE_MINUTE,
  key: (request) => `refresh:${clientIp(request)}`,
};

const viewRateLimit: RateLimitOptions = {
  limit: 10,
  windowMs: ONE_MINUTE,
  key: (request) => {
    const requestId = request.params.id;
    const id = Array.isArray(requestId) ? requestId[0] : requestId;
    return `views:${clientIp(request)}:${id ?? "unknown"}`;
  },
};

const supportCreateRateLimit: RateLimitOptions = {
  limit: 5,
  windowMs: ONE_MINUTE,
  key: (request) => {
    const user = (request as Request & { user?: { id?: string } }).user;
    return `support:create:${user?.id ?? clientIp(request)}`;
  },
};

const supportMessageRateLimit: RateLimitOptions = {
  limit: 20,
  windowMs: ONE_MINUTE,
  key: (request) => {
    const user = (request as Request & { user?: { id?: string } }).user;
    return `support:message:${user?.id ?? clientIp(request)}`;
  },
};

@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async onModuleInit() {
    const store = await initRateLimitStore();
    if (store instanceof RedisRateLimitStore) this.logger.log("Redis rate-limit store connected");
    else this.logger.warn("Using in-memory rate limits");
  }

  async canActivate(context: ExecutionContext) {
    const options = this.reflector.get<RateLimitOptions>(RATE_LIMIT_METADATA, context.getHandler());
    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { count, retryAfterSec } = await getRateLimitStore().hit(
      options.key(request),
      options.windowMs,
    );
    response.setHeader("X-RateLimit-Limit", String(options.limit));
    response.setHeader("X-RateLimit-Remaining", String(Math.max(0, options.limit - count)));
    if (count > options.limit) {
      response.setHeader("Retry-After", String(retryAfterSec));
      throw tooManyRequests("Too many requests. Please try again later.");
    }
    return true;
  }

  async onModuleDestroy() {
    await getRateLimitStore().close?.();
  }
}

function rateLimitDecorator(options: RateLimitOptions) {
  return applyDecorators(SetMetadata(RATE_LIMIT_METADATA, options), UseGuards(RateLimitGuard));
}

export const CredentialRateLimit = () => rateLimitDecorator(credentialRateLimit);
export const RefreshRateLimit = () => rateLimitDecorator(refreshRateLimit);
export const ViewRateLimit = () => rateLimitDecorator(viewRateLimit);
export const SupportCreateRateLimit = () => rateLimitDecorator(supportCreateRateLimit);
export const SupportMessageRateLimit = () => rateLimitDecorator(supportMessageRateLimit);
