# Gobid Admin

Next.js 16 ops dashboard for the Gobid marketplace. Authenticates against `@gobid/api` with HttpOnly JWT cookies and proxies Nest admin routes through a same-origin BFF.

## Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19 |
| UI | Tailwind CSS v4, shadcn/ui |
| Data | NestJS API via TanStack Query + `@monorepo/shared` |
| Auth | JWT access + refresh cookies (SameSite=Lax, HttpOnly) |
| Validation | Zod + React Hook Form |

Admin does **not** talk to Postgres directly. Schema and seeding live in `apps/api`.

## Getting started

```bash
# From repo root — API must be running with Postgres seeded
pnpm install
cp apps/admin/.env.example apps/admin/.env   # set API_URL
pnpm --filter @gobid/api db:generate
pnpm --filter @gobid/api db:push
pnpm --filter @gobid/api db:seed
pnpm dev:api      # :3000
pnpm dev:admin    # :3001
```

Open [http://localhost:3001](http://localhost:3001) — unauthenticated users are redirected to sign-in.

### Demo credentials (API seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@gobid.test` | `password123` |

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `API_URL` | Yes | Nest base URL (e.g. `http://localhost:3000`) |
| `COOKIE_SECURE` | No | Set `true` behind HTTPS |

See `.env.example`.

## Features

- **Authentication** — Login, logout, forgot/reset password (via Nest + Resend in production)
- **Route protection** — Proxy middleware + cookie session
- **Authorization** — Binary roles: `ADMIN` (full admin API) and `USER` (no admin access). Nav permission strings gate UI only; Nest `AdminGuard` enforces role on `/admin/*`
- **Marketplace ops** — Users, requests (approve/reject), offers, reviews, categories, conversations
- **Support help desk** — Tickets, notes, canned responses, bulk actions
- **Dashboard** — Live metrics from `GET /admin/dashboard/stats`
- **System status** — `GET /admin/system/status`
- **Dark mode** — Client theme toggle
- **Command palette** — ⌘K search over nav

## Project structure

```
app/
  (auth)/            # Sign-in, forgot password
  (dashboard)/       # Protected ops pages
  api/               # BFF: auth helpers + [...path] Nest proxy
  reset-password/    # Password reset UI
actions/             # Server actions (login/logout)
lib/
  api/               # React Query hooks → /api/*
  auth/              # Cookies, CSRF helper, guards
config/
  navigation.ts      # Sidebar + search
```

## API access

Browser calls same-origin `/api/...`. The catch-all proxy:

1. Rejects cross-origin mutating requests (CSRF / Origin check)
2. Allowlists Nest prefixes (`admin`, `notifications`, `uploads`, `auth/me`)
3. Attaches `Authorization: Bearer` from HttpOnly cookies
4. Refreshes once on `401`

Dedicated routes: `/api/auth/login`, `/refresh`, `/logout`, `/session`, `/forgot-password`, `/reset-password`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server on :3001 |
| `pnpm build` | Production build |
| `pnpm test` | Vitest unit tests |
| `pnpm typecheck` | TypeScript |

## Security

- Passwords hashed by Nest (bcrypt)
- HttpOnly auth cookies; BFF never accepts client-supplied `Authorization`
- Same-origin checks on mutating proxy requests
- Input validated with Zod at UI boundaries; Nest validates again

## License

Private — see repository owner.
