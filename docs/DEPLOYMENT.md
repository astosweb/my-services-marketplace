# Operations & deployment notes

## Environments

| Service | Port | Image target |
|---------|------|--------------|
| API | 3000 | `Dockerfile` target `api` |
| Admin | 3001 | `admin` |
| Web | 3002 | `web` |
| Redis | 6380→6379 | `redis:8` |

Postgres is external (Neon / managed). Set `DATABASE_URL` in the environment (see `.env.docker.example`).

Local full stack: copy `.env.docker.example` → `.env`, fill secrets + Neon URL, `pnpm docker:up`.

### Production domains (Gobid)

| Surface | URL |
|---------|-----|
| Web marketplace | `https://gobid.ee` |
| Admin | `https://admin.gobid.ee` |
| API | `https://api.gobid.ee` |
| Email from | `Gobid <no-reply@gobid.ee>` |

Set `NEXT_PUBLIC_SITE_URL=https://gobid.ee`, `NEXT_PUBLIC_WEB_URL=https://gobid.ee`, `API_PUBLIC_URL=https://api.gobid.ee`, `PASSWORD_RESET_URL=https://gobid.ee/reset-password`, and `CORS_ORIGIN=https://gobid.ee,https://admin.gobid.ee`.

## Schema changes

Prefer:

```bash
pnpm --filter @gobid/api db:generate
pnpm --filter @gobid/api db:push
```

SQL under `apps/api/prisma/migrations` may lag the schema. For shared production databases, take a backup before `db push`, or generate a reviewed migration offline before applying.

## Backups

**PostgreSQL**

- Use managed provider automated backups / PITR when available (DigitalOcean, Neon, RDS, etc.).
- Minimum: nightly `pg_dump` of `DATABASE_URL` stored off-box; test restore quarterly.
- Before destructive schema ops: snapshot or `pg_dump`.

**Object storage (Spaces)**

- Enable bucket versioning where supported.
- Treat `messages/*` and `support/*` as private; rotate access keys on staff change.

**Redis**

- Used for rate limits and BullMQ token cleanup — treat as ephemeral. AOF is enabled in compose for local durability only.

## Health

- `GET /health` — process liveness
- `GET /health/ready` — Postgres `SELECT 1`; Redis `PING` when `REDIS_URL` is set

Wire these into your load balancer / uptime checks. Add APM (e.g. Sentry) for error tracking in production.

## Secrets

Never commit `.env`. Production requires strong `JWT_SECRET`, explicit `CORS_ORIGIN`, Spaces credentials, `RESEND_API_KEY` / `EMAIL_FROM`, and Redis (or explicit `RATE_LIMIT_ALLOW_MEMORY=true` for single-node only).
