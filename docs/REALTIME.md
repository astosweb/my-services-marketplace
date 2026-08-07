# Realtime WebSocket Architecture

Gobid uses **Socket.IO** (`namespace: /realtime`) for production realtime updates across the NestJS API, Web marketplace, Admin panel, and iOS app.

## Goals

- Replace polling with push updates for chat, notifications, offers, jobs, support, and moderation
- Keep REST as the source of truth — sockets only fan out after durable writes
- Scale horizontally via the Socket.IO **Redis adapter**
- Authenticate every connection with JWT; authorize every room join

## Topology

```
Web / Admin (BFF cookies)          iOS (Bearer JWT)
        │                                │
        ▼                                │
 GET /api/auth/socket-token              │
        │                                │
        └────────────┬───────────────────┘
                     ▼
           NestJS Socket.IO `/realtime`
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
   RealtimePublisher      Redis adapter
   (REST → emit)          (multi-instance rooms)
```

## Module layout (`apps/api/src/realtime/`)

| File | Role |
|------|------|
| `realtime.module.ts` | Global module exporting publisher + presence |
| `realtime.gateway.ts` | Socket.IO gateway: auth, rooms, client events, rate limits |
| `realtime.publisher.ts` | Central emit API used by REST services |
| `realtime.presence.service.ts` | Online/offline + `User.lastSeenAt` (Redis TTL + DB) |
| `redis-io.adapter.ts` | `@socket.io/redis-adapter` when `REDIS_URL` is set |

Shared contracts live in `packages/shared/src/realtime.ts` (event names, Zod envelopes, room helpers).

## Rooms

| Room | Members |
|------|---------|
| `user:{userId}` | Auto-joined on connect (self only) |
| `conversation:{id}` | Conversation participants |
| `request:{id}` | Owner, offerers, conversation peers; admins; public open/in-progress observers |
| `support:{ticketId}` | Ticket creator + admins |
| `admin` / `admin:moderation` / `admin:support` | `ADMIN` role only |

Unauthorized `room.join` attempts are rejected.

## Server → client events

Versioned envelopes: `{ v: 1, event, ts, data }`.

Examples: `message.created`, `message.read`, `message.delivered`, `conversation.updated`, `unread.updated`, `typing.update`, `presence.update`, `notification.created`, `offer.created` / `offer.updated`, `request.*`, `job.progress`, `support.*`, `admin.moderation`, `admin.stats`, `payment.updated` (reserved).

## Client → server events

| Event | Purpose |
|-------|---------|
| `room.join` / `room.leave` | Subscribe to authorized rooms |
| `typing.update` | Chat / support typing indicators |
| `presence.ping` | Keep presence TTL alive |
| `message.delivered` / `message.read` | Delivery + read receipts |

Inbound events are Zod-validated and rate-limited (~60 events / min / socket; tighter for typing).

## Auth

1. Handshake requires JWT via `auth.token`, `Authorization: Bearer`, or `?token=`
2. Token verified with the same `JWT_SECRET` as REST
3. Banned users are disconnected
4. Web/Admin: BFF route `GET /api/auth/socket-token` returns the HttpOnly access JWT for the browser client
5. iOS: passes the in-memory access token into the Socket.IO handshake

## REST integration

Services inject `RealtimePublisher` and emit **after** successful DB commits:

- `ConversationsService` — messages, read, archive/pin
- `RequestsService` — offers, status, progress, request chat
- `PushService` / `NotificationsService` — notification fan-out + unread
- `SupportService` — tickets, messages, typing
- `AdminService` — approve/reject, offer moderation, bans

Business logic stays in REST; sockets never mutate domain state except lightweight read/delivered/typing.

## Clients

- **Web** (`apps/web/lib/realtime/`): Socket.IO client + `RealtimeProvider` invalidates React Query keys
- **Admin** (`apps/admin/lib/realtime/`): same pattern; removes notification polling
- **iOS** (`GobidApp/Core/Realtime/`): Engine.IO/Socket.IO client over `URLSessionWebSocketTask`, auto-reconnect, badge refresh

## Horizontal scaling

Set `REDIS_URL`. The Redis Io adapter keys under `gobid:socket.io`. Without Redis, sockets work on a single node (dev/test). Presence also uses Redis keys `presence:online:{userId}` when available.

## Ops notes

- CORS for Socket.IO mirrors `CORS_ORIGIN`
- Prefer `websocket` transport; polling remains as fallback
- Payloads stay small and versioned (`v: 1`) for forward compatibility
- Payments are off-platform today; `payment.updated` is reserved for future use
