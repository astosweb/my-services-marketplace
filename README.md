# Gobid — Local Services Marketplace

**Gobid** connects neighbors across Estonia with trusted local service providers. Post a service request, receive competitive offers, chat in real-time, track job progress, and leave reviews — accessible via Web, Admin Ops Dashboard, or the native iOS app.

> 📍 **Tagline**: *Local help, when you need it.*

---

## 🚀 Quick Overview

- **Two-Sided Marketplace**: Home & local services (plumbing, cleaning, handyman, moving, pet care, electrical, and more).
- **Core User Lifecycle**:
  `Request (PENDING_REVIEW → OPEN)` → `Offers (PENDING → ACCEPTED)` → `Job Progress (ACCEPTED → ON_THE_WAY → STARTED → PROVIDER_DONE → OWNER_CONFIRMED)` → `Review & Completion`.
- **Supported Cities**: Tallinn, Tartu, Pärnu, Narva.
- **Pricing Modes**: Provider quote (bidding) or owner fixed-price.

---

## 🏗️ Architecture & Monorepo Topology

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Web (3002) │  │ Admin (3001)│  │  iOS App    │
│  Next.js 16 │  │ Next.js 16  │  │  SwiftUI    │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │ BFF Cookies    │ BFF Cookies    │ Bearer JWT
       │ /api/* Proxy   │ /api/* Proxy   │
       └────────┬───────┴────────────────┘
                ▼
        ┌───────────────┐
        │  NestJS API   │
        │  Port 3000    │
        └───────┬───────┘
                │
     ┌──────────┼──────────┐
     ▼          ▼          ▼
 PostgreSQL   Redis    Spaces/Local
 (Port 5433) (Port 6380) Uploads
```

| Application / Package | Stack | Port / Target | Role & Responsibility |
|-----------------------|-------|---------------|-----------------------|
| **API** (`apps/api`) | NestJS 11, Node 22, Prisma 7, Passport JWT, Socket.IO | `http://localhost:3000` | REST + realtime API for Auth, Marketplace, Messaging, Support, Uploads, Admin |

| **Admin** (`apps/admin`) | Next.js 16 (App Router), React 19, Tailwind CSS v4 | `http://localhost:3001` | Ops Dashboard for moderation, support desk, users, categories |
| **Web** (`apps/web`) | Next.js 16 (App Router), React 19, Tailwind CSS v4 | `http://localhost:3002` | Public marketplace portal for browsable requests, offers, profile |
| **Shared** (`packages/shared`) | TypeScript, Zod | `@monorepo/shared` | Shared API contracts, validation schemas, and common types |
| **iOS** (`ios-app`) | SwiftUI, MapKit, Keychain | Native iOS | Native iOS client talking directly to NestJS API via Bearer JWT |

---

## 📚 Complete Project Documentation (`/docs`)

For exhaustive guides on architecture, business logic, APIs, and security, refer to the documentation suite in [`/docs`](docs/):

- 📐 **[Architecture Overview](docs/ARCHITECTURE.md)** — Monorepo topology, 3-tier layout, request flow, and BFF proxy design.
- 🔄 **[Domain Model & State Machines](docs/DOMAIN_MODEL.md)** — Entities, relations, Prisma schema graph, and formal status transition rules.
- 🔑 **[Authentication & Security](docs/AUTH_AND_SECURITY.md)** — JWT lifecycle, HttpOnly cookies, CSRF, iOS Keychain, HMAC upload signing, and RBAC.
- 📡 **[API Reference & Conventions](docs/API_GUIDE.md)** — REST standards, `{ data }` / `{ error }` envelopes, status codes, pagination, rate limits.
- 🗄️ **[Database Schema Guide](docs/DATABASE_SCHEMA.md)** — Prisma models, indexes, `db push` workflow, retention rules, and seed data.
- 💻 **[Web Marketplace Guide](docs/WEB_APP_GUIDE.md)** — Next.js web app architecture, TanStack Query, BFF proxy route handlers.
- 🛠️ **[Admin Panel Guide](docs/ADMIN_APP_GUIDE.md)** — Next.js admin dashboard, support ticket queue, moderation rules, binary RBAC.
- 📱 **[Mobile App Guide](docs/MOBILE_APP_GUIDE.md)** — iOS SwiftUI architecture, MapKit integration, token refresher queue.
- 📦 **[Shared Contracts Guide](docs/SHARED_CONTRACTS.md)** — `@monorepo/shared` Zod schemas, Nest DTO mapping, contract boundary validation.
- ⚙️ **[Background Jobs & Redis](docs/JOBS_AND_REDIS.md)** — BullMQ cron tasks, Redis rate-limiter, Socket.IO Redis adapter.
- 🔴 **[Realtime WebSockets](docs/REALTIME.md)** — Socket.IO architecture, rooms, JWT auth, publisher, client integration.
- 💻 **[Development Guide](docs/DEVELOPMENT_GUIDE.md)** — Local setup, environment configuration, pnpm commands, Docker workflow.
- 🧪 **[Testing Strategy](docs/TESTING_STRATEGY.md)** — Vitest, Jest, integration testing patterns, and CI quality gates.
- 🚀 **[Operations & Deployment](docs/DEPLOYMENT.md)** — Docker targets, production domains, database backups, health checks.

---

## 🤖 AI Agent Quick Start

If you are an AI coding assistant (Cursor, Claude Code, Codex, Antigravity, etc.), please start by reading **[`AGENTS.md`](AGENTS.md)**. It serves as your primary 5-minute onboarding guide and defines non-negotiable architectural constraints.

---

## ⚡ Local Development Quick Start

### Prerequisites

- Node.js ≥ 22, pnpm ≥ 10
- Docker Desktop (for PostgreSQL & Redis)

### Step-by-Step Setup

```bash
# 1. Environment configuration
cp .env.docker.example .env
cp apps/api/.env.example apps/api/.env

# 2. Install dependencies
pnpm install

# 3. Start database (Postgres on 5433) & Redis (on 6380)
pnpm --filter @gobid/api docker:up

# 4. Generate Prisma client & seed initial data
pnpm --filter @gobid/api db:generate
pnpm --filter @gobid/api db:push
pnpm --filter @gobid/api db:seed

# 5. Start development servers
pnpm dev:api      # NestJS API (http://localhost:3000) - Swagger UI: /docs
pnpm dev:admin    # Next.js Admin (http://localhost:3001)
pnpm dev:web      # Next.js Web (http://localhost:3002)
```

For full stack containerization details, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 📄 License & Access

Private repository — all rights reserved.
