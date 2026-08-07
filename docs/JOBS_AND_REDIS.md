# Background Jobs, Redis & Caching Guide

## Overview

Gobid utilizes **Redis 8** for distributed rate limiting, Pub/Sub event broadcasting, and background job scheduling via **BullMQ 5** (`apps/api/src/jobs/`).

---

## 1. Background Jobs (BullMQ 5)

Job processing is managed by `JobsModule`. When `REDIS_URL` is configured, BullMQ handles daily background tasks:

| Job Queue Name | Processor Class | Schedule | Description |
|----------------|-----------------|----------|-------------|
| `token-cleanup` | `TokenCleanupProcessor` | Daily at 03:00 UTC (`0 3 * * *`) | Deletes expired rows from `RefreshToken` and `PasswordResetToken` tables |

> [!NOTE]
> If `REDIS_URL` is not provided (e.g. basic single-instance dev environment), `JobsModule` falls back to an in-memory Node.js interval timer for token cleanup.

---

## 2. Distributed Rate Limiting

Rate limiting is enforced by `RateLimitGuard` (`apps/api/src/common/guards/rate-limit.guard.ts`):

- **Mechanism**: Atomic sliding-window rate limiter executed via custom Redis Lua script (`INCR` + `PEXPIRE`).
- **Limits**: ~100 requests per minute per IP address / authenticated user ID.
- **Fallback**: If Redis connection is unavailable or `RATE_LIMIT_ALLOW_MEMORY=true` is set, the guard falls back to a thread-safe in-memory sliding window Map with periodic expiration sweeps.

---

## 3. Realtime (Socket.IO + Redis adapter)

Production realtime lives in `apps/api/src/realtime/` (see [`docs/REALTIME.md`](REALTIME.md)):

- **Transport**: Socket.IO namespace `/realtime`
- **Scaling**: `@socket.io/redis-adapter` when `REDIS_URL` is set (key prefix `gobid:socket.io`)
- **Presence**: Redis keys `presence:online:{userId}` with TTL + `User.lastSeenAt`
- **Typing**: Socket events (`typing.update` / `support.typing`); legacy HTTP typing endpoints remain for compatibility and still sync via Redis keys `support:typing:<ticketId>:<userId>`
