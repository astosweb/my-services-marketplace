# Hero API

Hono + Prisma backend for the Hero marketplace app. Data lives in PostgreSQL; file keys point at DigitalOcean Spaces (served via API `/uploads/…`, or CDN when `SPACES_CDN_PUBLIC=true`).

## Setup

```bash
cp .env.example .env
# Edit DATABASE_URL / REDIS_URL (and Spaces vars when ready)

# Local Postgres + Redis (latest images)
docker compose up -d

pnpm install
pnpm db:generate   # required after schema changes (Prisma 7)
# Local prototype (optional): pnpm db:push
# Preferred (versioned): create/apply migrations
pnpm db:migrate        # dev: create + apply
# Production / CI empty DB:
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

Server defaults to `http://localhost:3000`.

| Service  | Host port | Credentials                                  |
| -------- | --------- | -------------------------------------------- |
| Postgres | `5433`    | `hero` / `hero`, db `hero`                |
| Redis    | `6380`    | no auth (`REDIS_URL=redis://localhost:6380`) |

Compose images are pinned to `postgres:16` and `redis:7` (not `:latest`). The optional `api` service builds from `Dockerfile` and waits on healthy Postgres/Redis.

```bash
# Infra only
docker compose up -d postgres redis

# Full stack (set JWT_SECRET / CORS_ORIGIN in the environment or a .env file)
docker compose up -d --build
# Then: docker compose exec api pnpm db:migrate:deploy   # or run migrate in an init job
```

Deploy targets (DigitalOcean App Platform, Fly.io, Render): build the `Dockerfile`, set secrets via env, run `pnpm db:migrate:deploy` before or on boot, probe `/health` and `/health/ready`.

Host ports are `5433` / `6380` so they don’t clash with other local Postgres/Redis on `5432` / `6379`.

## Scripts

| Command                             | Description                                 |
| ----------------------------------- | ------------------------------------------- |
| `pnpm dev`                          | Run API with hot reload                     |
| `pnpm build`                        | Compile TypeScript (tsc 7)                  |
| `pnpm start`                        | Run compiled build                          |
| `pnpm typecheck`                    | Type-check without emit                     |
| `pnpm lint` / `pnpm lint:fix`       | ESLint                                      |
| `pnpm format` / `pnpm format:check` | Prettier                                    |
| `pnpm test`                         | Vitest                                      |
| `pnpm db:generate`                  | Generate Prisma client                      |
| `pnpm db:migrate`                   | Create/apply migrations (dev)               |
| `pnpm db:migrate:deploy`            | Apply pending migrations (prod/CI)          |
| `pnpm db:migrate:status`            | Show migration status                       |
| `pnpm db:push`                      | Sync schema without migration history (local prototype only) |
| `pnpm db:seed`                      | Seed categories, sample users, and requests |

CI runs on pull requests and pushes that touch `apps/api/` (see `.github/workflows/api-ci.yml`): `pnpm lint`, `typecheck`, `test`, and `build`.

### Database: migrate vs push

**Production and shared environments must use `pnpm db:migrate:deploy`**, not `db:push`. Migrations live under `prisma/migrations/` and are the source of truth for schema history.

`pnpm db:push` remains available for throwaway local prototyping when you intentionally skip migration files. After schema changes intended for production, always create a migration (`pnpm db:migrate`) and commit it.

## Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | — | Liveness |
| GET | `/health/ready` | — | DB connectivity |
| GET | `/categories` | — | List job categories |
| GET | `/requests` | optional | List requests (`?city=&categoryId=&status=&limit=&offset=`) |
| GET | `/requests/mine` | Bearer | Own requests as owner or provider (`?role=owner\|provider`) |
| GET | `/requests/:id` | optional | Request detail |
| POST | `/requests/:id/views` | optional | Increment view count (skips owner self-views; rate-limited) |
| POST | `/requests` | Bearer | Create request (`photoKeys`, `pricingMode`, …) |
| PATCH | `/requests/:id` | Bearer | Owner edits open request with **no offers** yet |
| GET | `/requests/:id/offers` | Bearer | List offers |
| POST | `/requests/:id/offers` | Bearer | Create offer / fixed-price interest |
| PATCH | `/requests/:id/offers/:offerId` | Bearer | Accept / decline / withdraw offer |
| PATCH | `/requests/:id/status` | Bearer | Owner complete / cancel (`PROVIDER_DONE` required to complete) |
| PATCH | `/requests/:id/progress` | Bearer | Provider advances progress one step |
| POST | `/requests/:id/reviews` | Bearer | Leave review after completion |
| GET | `/requests/:id/conversation` | Bearer | Fetch existing thread messages |
| POST | `/requests/:id/conversation` | Bearer | Open thread (offer/owner policy) |
| POST | `/requests/:id/messages` | Bearer | Message owner (offer policy) |
| GET | `/conversations` | Bearer | Inbox (`?archived=true\|false`); `meta.unreadCount` |
| GET | `/conversations/:id/messages` | Bearer | Full message history (marks read) |
| POST | `/conversations/:id/messages` | Bearer | Send text/attachment message |
| POST | `/conversations/:id/read` | Bearer | Mark conversation read |
| PATCH | `/conversations/:id/archive` | Bearer | Archive / unarchive |
| PATCH | `/conversations/:id/pin` | Bearer | Pin / unpin |
| GET | `/notifications` | Bearer | List notifications (`?limit=`); `meta.unreadCount` |
| PATCH | `/notifications/:id` | Bearer | Mark one notification read |
| POST | `/notifications/read-all` | Bearer | Mark all read |
| POST | `/uploads/request-photos` | Bearer | Multipart job photos (max 9) |
| POST | `/uploads/message-attachments` | Bearer | Multipart message file |
| POST | `/uploads/avatars` | Bearer | Multipart avatar |
| GET | `/uploads/*` | signed/Bearer for `messages/` | Serve local/Spaces object; public for `requests/`/`avatars/` |
| POST | `/auth/register` | — | Register (`email`, `password`, `displayName`) |
| POST | `/auth/login` | — | Login |
| POST | `/auth/refresh` | — | Rotate refresh token (atomic; reuse revokes family) |
| POST | `/auth/logout` | — | Revoke refresh token |
| POST | `/auth/forgot-password` | — | Request password reset |
| POST | `/auth/reset-password` | — | Consume reset token |
| GET | `/auth/me` | Bearer | Current user |
| GET | `/auth/me/stats` | Bearer | Posted / completed / review counts |
| PATCH | `/auth/me` | Bearer | Update own profile |
| DELETE | `/auth/me` | Bearer | Hard-delete account (`{ password }`) → 204 |
| GET | `/users/:id` | — | Public user profile |
| GET | `/users/:id/reviews` | — | Reviews received (max 50) |
| PATCH | `/users/:id` | Bearer | Update own profile / `avatarKey` (own id only) |
| POST | `/devices` | Bearer | Register APNs/FCM device token |
| DELETE | `/devices/:token` | Bearer | Remove device token |

User signup is **only** via `POST /auth/register`. `POST /users` is not available.

All error responses may include `error.requestId` matching response header `x-request-id`.

### City query values

`TALLINN`, `TARTU`, `PARNU`, `NARVA` (matches Prisma `EstonianCity` enum).

## Env

See `.env.example`. Minimum required: `DATABASE_URL`, `JWT_SECRET` (32+ characters). `PASSWORD_RESET_URL` is the frontend reset page; development and test forgot-password responses include the raw token and this link, while production responses never expose them. Reset tokens expire after one hour, are stored as SHA-256 hashes, are single-use, and revoke all refresh tokens when consumed. For DigitalOcean Managed Postgres, set `DATABASE_SSL_REJECT_UNAUTHORIZED=false` if you hit SSL cert errors. Photo/avatar URLs default to `API_PUBLIC_URL/uploads/…` (API proxies Spaces). Set `SPACES_CDN_PUBLIC=true` plus `SPACES_CDN_URL` only after anonymous GetObject works on the Space. Set `CORS_ORIGIN` to a comma-separated allowlist in production (defaults to `*` for local/dev). **Production boot fails if `CORS_ORIGIN=*`.**

Uses **Prisma ORM 7** with `prisma.config.ts`, generated client at `src/generated/prisma`, and `@prisma/adapter-pg`.

### Rate limiting

Auth credential endpoints (`/auth/login`, `/auth/register`, `/auth/forgot-password`) are limited to **5 requests/minute** per client IP + email. Refresh is **30/minute** per IP. Request view increments are **10/minute** per IP + request id. Exceeding a limit returns `429` with `{ error: { code: "RATE_LIMITED" } }` and a `Retry-After` header.

Counters use **Redis** when `REDIS_URL` is set (recommended for production / multi-instance). Without Redis, an **in-memory** store is used (fine for local/dev). Production refuses to boot without `REDIS_URL` unless `RATE_LIMIT_ALLOW_MEMORY=true` (single-node only).

### Messaging & private files

- **Who can chat:** Request owner ↔ accepted provider, or any user with a **pending or accepted** offer on that request. Unrelated authenticated users receive `403`.
- **Message attachments** (`messages/…` keys) are stored private (no object ACL; omit them from any public bucket policy). API responses expose short-lived signed `/uploads/…?token=&exp=` URLs (15 minutes). Anonymous `GET` without a valid token is rejected; Bearer auth is accepted as a fallback when the caller owns the key or is a conversation participant.
- Uploads never set `ACL` on PutObject (Spaces with ACLs disabled reject it). Request photos/avatars are served through authenticated Spaces reads on `GET /uploads/…` unless `SPACES_CDN_PUBLIC=true`.

### Account deletion

`DELETE /auth/me` with body `{ "password": "…" }` **hard-deletes** the user. Prisma cascades remove refresh/reset tokens, device tokens, owned requests (and related offers/conversations/messages), offers, notifications, and reviews given or received. Prefer this over soft-delete for App Store / GDPR account removal. The client must clear local credentials after `204`.

See [MIGRATION.md](./MIGRATION.md) for the latest dependency and tooling upgrade notes.
