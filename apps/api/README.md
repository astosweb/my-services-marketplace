# Hero API

Production NestJS API for the Hero service marketplace.

## Stack

- Node.js 22+/24 LTS, TypeScript 5.9, NestJS 11
- PostgreSQL 18, Prisma 7
- Redis 8, BullMQ 5
- Passport JWT, Swagger/OpenAPI
- pnpm 10

## Local setup

```bash
cp .env.example .env
pnpm install
pnpm docker:up
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

API: `http://localhost:3000`  
Swagger UI: `http://localhost:3000/docs`  
OpenAPI JSON: `http://localhost:3000/docs/openapi.json`

Use `prisma db push` to apply the existing schema. Existing migration files remain preserved
for deployed databases.

## Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm db:generate
pnpm db:push
pnpm db:seed
```

## Environment

Startup validates every variable. Required:

- `DATABASE_URL`
- `JWT_SECRET` (at least 32 characters)

Production also requires:

- explicit `CORS_ORIGIN` allowlist
- `REDIS_URL`, unless `RATE_LIMIT_ALLOW_MEMORY=true` is intentionally used for one instance

See `.env.example` for storage, JWT, Redis, CORS, and logging options.

## API

All JSON success responses preserve the `{ "data": ... }` envelope. List endpoints add
`meta`. Errors use:

```json
{
  "error": {
    "message": "Not found",
    "code": "NOT_FOUND",
    "requestId": "..."
  }
}
```

### Health

- `GET /health`
- `GET /health/ready`

### Authentication

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me`
- `GET /auth/me/stats`
- `PATCH /auth/me`
- `DELETE /auth/me`

### Marketplace

- `GET|POST /requests`
- `GET /requests/mine`
- `GET|PATCH /requests/:id`
- `POST /requests/:id/views`
- `GET|POST /requests/:id/offers`
- `PATCH /requests/:id/offers/:offerId`
- `PATCH /requests/:id/status`
- `PATCH /requests/:id/progress`
- `POST /requests/:id/reviews`
- `GET|POST /requests/:id/conversation`
- `POST /requests/:id/messages`
- `GET /categories`

### Messaging and notifications

- `GET /conversations`
- `PATCH /conversations/:id/archive`
- `PATCH /conversations/:id/pin`
- `GET|POST /conversations/:id/messages`
- `POST /conversations/:id/read`
- `GET /notifications`
- `PATCH /notifications/:id`
- `POST /notifications/read-all`

### Profiles, devices, and uploads

- `GET /users/:id`
- `GET /users/:id/reviews`
- `PATCH /users/:id`
- `POST /devices`
- `DELETE /devices/:token`
- `POST /uploads/request-photos`
- `POST /uploads/message-attachments`
- `POST /uploads/avatars`
- `GET /uploads/*`

### Admin

Admin-only routes require a JWT for a user with `role=ADMIN`. Sign in with
`POST /admin/auth/login` (non-admins are rejected). Seeded admin:
`admin@hero.test` / `password123`.

- `POST /admin/auth/login`
- `GET /admin/me`
- `GET /admin/dashboard`
- `GET|PATCH|DELETE /admin/users/:id`
- `POST /admin/users/:id/revoke-sessions`
- `GET|PATCH|DELETE /admin/requests/:id`
- `GET /admin/offers`
- `GET|DELETE /admin/reviews/:id`
- `GET|POST|PATCH|DELETE /admin/categories`

Web UI lives in `apps/admin` (Next.js on port 3001).

Message attachments are private and require either a short-lived signed URL or authorized
conversation access. Request photos and avatars are public.

## Operations

Prisma connects and disconnects through `PrismaService`. Redis backs distributed rate limits.
When Redis is configured, BullMQ runs a daily cleanup queue for expired refresh and password
reset tokens. Request/response logs are structured JSON with credentials redacted.
