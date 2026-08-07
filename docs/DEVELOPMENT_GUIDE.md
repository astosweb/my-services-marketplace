# Local Development Guide

## Prerequisites

- **Node.js**: ≥ 22.0.0
- **pnpm**: ≥ 10.0.0 (`npm i -g pnpm`)
- **Docker & Docker Compose**: For local PostgreSQL 18 & Redis 8
- **Xcode**: 15+ (optional, for running `ios-app` in iOS Simulator)

---

## Environment Setup

```bash
# 1. Clone repository & enter workspace
git clone <repository-url>
cd my-services-marketplace

# 2. Configure environment files
cp .env.docker.example .env
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/web/.env.example apps/web/.env

# 3. Install pnpm dependencies across monorepo
pnpm install

# 4. Start local Postgres (port 5433) and Redis (port 6380)
pnpm --filter @gobid/api docker:up

# 5. Apply Prisma schema and populate seed data
pnpm --filter @gobid/api db:generate
pnpm --filter @gobid/api db:push
pnpm --filter @gobid/api db:seed
```

---

## Running Applications

Start servers in separate terminal tabs or run parallel dev scripts:

| Command | URL | Description |
|---------|-----|-------------|
| `pnpm dev:api` | `http://localhost:3000` | NestJS API (Swagger UI: `http://localhost:3000/docs`) |
| `pnpm dev:admin` | `http://localhost:3001` | Admin Ops Dashboard |
| `pnpm dev:web` | `http://localhost:3002` | Public Web Marketplace |

### LAN access (phone / other devices)

Set `LAN_LOCAL_IP_ADDRESS` in the **repo-root** `.env` (see `.env.docker.example`) to your Mac’s LAN IP (`ipconfig getifaddr en0`). Leave empty for localhost-only.

When set, `pnpm dev:api` / `pnpm dev:web` (or `pnpm apply:lan`) will:

- Bind web on `0.0.0.0` → open `http://<ip>:3002` on the device
- Point iOS `GOBID_API_BASE_URL` at `http://<ip>:3000` (rebuild the app in Xcode)
- Rewrite local `API_PUBLIC_URL` so media URLs work on the LAN

---

## Demo Credentials (Post-Seed)

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@gobid.test` | `password123` |
| **Requester** | `owner1@gobid.test` | `password123` |
| **Provider** | `provider1@gobid.test` | `password123` |

---

## Monorepo Commands Reference

```bash
# Code Quality Gates
pnpm typecheck   # Typecheck TypeScript across all packages & apps
pnpm lint        # Run ESLint across monorepo
pnpm format      # Prettier format check

# App Builds
pnpm build:api   # Build NestJS API package
pnpm build:admin # Build Next.js Admin app
pnpm build:web   # Build Next.js Web marketplace app
```
