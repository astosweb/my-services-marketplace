# AGENTS.md

Guidance for AI agents working in the admin app.

Monorepo-wide standards live in the root [`AGENTS.md`](../../AGENTS.md).

## Project overview

Next.js 16 admin panel that proxies `@hero/api`. Do **not** add Prisma queries in the admin UI.

| Layer | Stack |
|-------|-------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Language | TypeScript (strict) |
| Data | NestJS via `lib/api/*` + `@monorepo/shared` |
| Package manager | **pnpm** |

## Setup

```bash
pnpm install
cp .env.example .env   # API_URL=http://localhost:3000
# Seed via API: pnpm --filter @hero/api db:seed
pnpm dev               # http://localhost:3001
```

## Database

Schema changes: edit `apps/api/prisma/schema.prisma`, then `pnpm db:generate` and `pnpm db:push` from the API package. Admin `lib/prisma.ts` is a throw-stub.

## Data access

- Use React Query hooks in `lib/api/*`
- Never `fetch` ad hoc in components when a hook exists
- Never instantiate Prisma in admin

## Auth

HttpOnly JWT cookies + BFF. Login requires Nest user `role === "ADMIN"`. Roles are binary (`USER` | `ADMIN`); permission strings only gate navigation.

## Agent workflow

1. Match existing patterns
2. After schema changes: generate + push via API package
3. `pnpm lint` / `pnpm typecheck` for non-trivial changes
4. Do not resurrect mock settings/billing/auth-template pages
