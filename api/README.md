# Davay API

Hono + Prisma backend for the Davay marketplace app. Data lives in PostgreSQL; file keys point at DigitalOcean Spaces (URLs built when `SPACES_CDN_URL` is set).

## Setup

```bash
cp .env.example .env
# Edit DATABASE_URL / REDIS_URL (and Spaces vars when ready)

# Local Postgres + Redis (latest images)
docker compose up -d

pnpm install
pnpm db:generate   # required after schema changes (Prisma 7)
pnpm db:push
pnpm db:seed
pnpm dev
```

Server defaults to `http://localhost:3000`.

| Service  | Host port | Credentials                                  |
| -------- | --------- | -------------------------------------------- |
| Postgres | `5433`    | `davay` / `davay`, db `davay`                |
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
| `pnpm db:push`                      | Sync schema to database                     |
| `pnpm db:seed`                      | Seed categories, sample users, and requests |

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
| POST   | `/requests/:id/conversation` | Start or open a 1:1 chat with the post owner (or accepted provider if owner). No offer required. Bearer token. |
| POST   | `/requests/:id/messages`  | Message post owner (Bearer token; `body`). Creates a 1:1 conversation if needed. No offer required.                                                                   |
| POST   | `/auth/register`          | Register (`email`, `password`, `displayName`)                                                                                                                       |
| POST   | `/auth/login`             | Login (`email`, `password`)                                                                                                                                         |
| POST   | `/auth/refresh`           | Rotate tokens (`refreshToken`)                                                                                                                                      |
| POST   | `/auth/logout`            | Revoke refresh token (`refreshToken`)                                                                                                                               |
| POST   | `/auth/forgot-password`   | Request a password reset (`email`); always returns a generic response                                                                                               |
| POST   | `/auth/reset-password`    | Consume a reset token and replace the password (`token`, `password`)                                                                                                |
| GET    | `/auth/me`                | Current user (Bearer token)                                                                                                                                         |
| GET    | `/auth/me/stats`          | Activity stats: posted, completed, review counts (Bearer token)                                                                                                     |
| PATCH  | `/auth/me`                | Update own profile (`displayName`, `bio`)                                                                                                                           |
| GET    | `/users/:id`              | User profile                                                                                                                                                        |
| POST   | `/users`                  | Create user profile (no password; prefer `/auth/register`)                                                                                                          |
| PATCH  | `/users/:id`              | Update own profile / `avatarKey` (Bearer token, own id only)                                                                                                        |

### City query values

`TALLINN`, `TARTU`, `PARNU`, `NARVA` (matches Prisma `EstonianCity` enum).

## Env

See `.env.example`. Minimum required: `DATABASE_URL`, `JWT_SECRET` (32+ characters). `PASSWORD_RESET_URL` is the frontend reset page; development and test forgot-password responses include the raw token and this link, while production responses never expose them. Reset tokens expire after one hour, are stored as SHA-256 hashes, are single-use, and revoke all refresh tokens when consumed. For DigitalOcean Managed Postgres, set `DATABASE_SSL_REJECT_UNAUTHORIZED=false` if you hit SSL cert errors. Set `SPACES_CDN_URL` so API responses include public photo/avatar URLs. Set `CORS_ORIGIN` to a comma-separated allowlist in production (defaults to `*`).

Uses **Prisma ORM 7** with `prisma.config.ts`, generated client at `src/generated/prisma`, and `@prisma/adapter-pg`.

See [MIGRATION.md](./MIGRATION.md) for the latest dependency and tooling upgrade notes.
