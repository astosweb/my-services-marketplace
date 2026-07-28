# Hero API

Hono + Prisma backend for the Hero marketplace app. Data lives in PostgreSQL; file keys point at DigitalOcean Spaces (URLs built when `SPACES_CDN_URL` is set).

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

CI runs on pull requests and pushes that touch `api/` (see `.github/workflows/api-ci.yml`): `pnpm lint`, `typecheck`, `test`, and `build`.

### Database: migrate vs push

**Production and shared environments must use `pnpm db:migrate:deploy`**, not `db:push`. Migrations live under `prisma/migrations/` and are the source of truth for schema history.

`pnpm db:push` remains available for throwaway local prototyping when you intentionally skip migration files. After schema changes intended for production, always create a migration (`pnpm db:migrate`) and commit it.

## Endpoints

| Method | Path                      | Description                                                                                                                                                         |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                 | Liveness                                                                                                                                                            |
| GET    | `/health/ready`           | DB connectivity                                                                                                                                                     |
| GET    | `/categories`             | List job categories                                                                                                                                                 |
| GET    | `/requests`               | List requests (`?city=TALLINN&categoryId=plumbing`)                                                                                                                 |
| GET    | `/requests/:id`           | Request detail                                                                                                                                                      |
| POST   | `/uploads/request-photos` | Upload job photos (Bearer token; multipart `photos`, max 6)                                                                                                         |
| POST   | `/requests`               | Create request (Bearer token; optional `photoKeys`; `pricingMode` can be `PROVIDER_OFFERS` or `OWNER_FIXED_PRICE`)                                                  |
| GET    | `/requests/:id/offers`    | List offers                                                                                                                                                         |
| POST   | `/requests/:id/offers`    | Create price offer or fixed-price interest (Bearer token; `priceCents` required for provider-priced requests, omitted for fixed-price requests; optional `message`) |
| POST   | `/requests/:id/conversation` | Start or open a 1:1 chat. Bearer. Allowed only for the request owner (with an accepted provider) or a user with a pending/accepted offer. |
| POST   | `/requests/:id/messages`  | Message post owner (Bearer; `body`). Same offer/owner policy as conversation open. Creates a 1:1 conversation if needed. |
| POST   | `/auth/register`          | Register (`email`, `password`, `displayName`)                                                                                                                       |
| POST   | `/auth/login`             | Login (`email`, `password`)                                                                                                                                         |
| POST   | `/auth/refresh`           | Rotate tokens (`refreshToken`)                                                                                                                                      |
| POST   | `/auth/logout`            | Revoke refresh token (`refreshToken`)                                                                                                                               |
| POST   | `/auth/forgot-password`   | Request a password reset (`email`); always returns a generic response                                                                                               |
| POST   | `/auth/reset-password`    | Consume a reset token and replace the password (`token`, `password`)                                                                                                |
| GET    | `/auth/me`                | Current user (Bearer token)                                                                                                                                         |
| GET    | `/auth/me/stats`          | Activity stats: posted, completed, review counts (Bearer token)                                                                                                     |
| PATCH  | `/auth/me`                | Update own profile (`displayName`, `bio`)                                                                                                                           |
| DELETE | `/auth/me`                | Hard-delete account (Bearer; body `{ password }`). Cascades tokens, devices, requests, messages, reviews. Returns 204.                                              |
| GET    | `/users/:id`              | User profile                                                                                                                                                        |
| GET    | `/users/:id/reviews`      | Reviews received by user (max 50)                                                                                                                                   |
| PATCH  | `/users/:id`              | Update own profile / `avatarKey` (Bearer token, own id only)                                                                                                        |

User signup is **only** via `POST /auth/register` (email + password + displayName). `POST /users` is not available.

### City query values

`TALLINN`, `TARTU`, `PARNU`, `NARVA` (matches Prisma `EstonianCity` enum).

## Env

See `.env.example`. Minimum required: `DATABASE_URL`, `JWT_SECRET` (32+ characters). `PASSWORD_RESET_URL` is the frontend reset page; development and test forgot-password responses include the raw token and this link, while production responses never expose them. Reset tokens expire after one hour, are stored as SHA-256 hashes, are single-use, and revoke all refresh tokens when consumed. For DigitalOcean Managed Postgres, set `DATABASE_SSL_REJECT_UNAUTHORIZED=false` if you hit SSL cert errors. Set `SPACES_CDN_URL` so API responses include public photo/avatar URLs. Set `CORS_ORIGIN` to a comma-separated allowlist in production (defaults to `*` for local/dev). **Production boot fails if `CORS_ORIGIN=*`.**

Uses **Prisma ORM 7** with `prisma.config.ts`, generated client at `src/generated/prisma`, and `@prisma/adapter-pg`.

### Rate limiting

Auth credential endpoints (`/auth/login`, `/auth/register`, `/auth/forgot-password`) are limited to **5 requests/minute** per client IP + email. Refresh is **30/minute** per IP. Request view increments are **10/minute** per IP + request id. Exceeding a limit returns `429` with `{ error: { code: "RATE_LIMITED" } }` and a `Retry-After` header.

Counters use **Redis** when `REDIS_URL` is set (recommended for production / multi-instance). Without Redis, an **in-memory** store is used (fine for local/dev). Production refuses to boot without `REDIS_URL` unless `RATE_LIMIT_ALLOW_MEMORY=true` (single-node only).

### Messaging & private files

- **Who can chat:** Request owner ↔ accepted provider, or any user with a **pending or accepted** offer on that request. Unrelated authenticated users receive `403`.
- **Message attachments** (`messages/…` keys) are stored **private** (no Spaces `public-read`). API responses expose short-lived signed `/uploads/…?token=&exp=` URLs (15 minutes). Anonymous `GET` without a valid token is rejected; Bearer auth is accepted as a fallback when the caller owns the key or is a conversation participant.
- Request photos and avatars may remain publicly readable for marketplace browse.

### Account deletion

`DELETE /auth/me` with body `{ "password": "…" }` **hard-deletes** the user. Prisma cascades remove refresh/reset tokens, device tokens, owned requests (and related offers/conversations/messages), offers, notifications, and reviews given or received. Prefer this over soft-delete for App Store / GDPR account removal. The client must clear local credentials after `204`.

See [MIGRATION.md](./MIGRATION.md) for the latest dependency and tooling upgrade notes.
