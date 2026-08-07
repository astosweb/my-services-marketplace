# AGENTS.md — Global AI Agent Guidance

Welcome to **Gobid**, a two-sided local services marketplace monorepo (`apps/api`, `apps/admin`, `apps/web`, `packages/shared`, `ios-app`).

This file is the primary entrypoint for AI coding agents (Cursor, Claude Code, Codex, Antigravity, etc.). By following this document and its referenced guides, you should be fully productive in **under 5 minutes** without needing to scan the entire codebase.

---

## ⚡ 5-Minute AI Agent Bootstrap Flow

Before writing code or making architectural decisions, follow this targeted reading order:

1. **Understand System Topology (1 min)**: Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for monorepo layout, 3-tier structure, and BFF cookie proxy mechanics.
2. **Understand Business Logic & State Machines (1.5 min)**: Read [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md) for entity relations and status transition rules (`ServiceRequest`, `Offer`, `JobProgress`, `SupportTicket`).
3. **Understand Auth & Security Boundaries (1 min)**: Read [`docs/AUTH_AND_SECURITY.md`](docs/AUTH_AND_SECURITY.md) for JWT cookies, iOS Keychain auth, HMAC upload signing, and RBAC rules.
4. **Read App-Specific Guidance (1 min)**:
   - Working on API? → [`apps/api/AGENTS.md`](apps/api/AGENTS.md)
   - Working on Web App? → [`apps/web/AGENTS.md`](apps/web/AGENTS.md)
   - Working on Admin Panel? → [`apps/admin/AGENTS.md`](apps/admin/AGENTS.md)
   - Working on Shared Contracts? → [`packages/shared/AGENTS.md`](packages/shared/AGENTS.md)
   - Working on iOS Client? → [`ios-app/AGENTS.md`](ios-app/AGENTS.md)

---

## 🛡️ Non-Negotiable Architectural Invariants

Do **NOT** break or contradict these foundational architecture rules:

1. **Single API Ownership**: NestJS in `apps/api` owns all database interactions, business logic, authentication, marketplace operations, support desk, upload storage, and admin routes.
2. **Single Schema**: PostgreSQL database schema lives strictly at `apps/api/prisma/schema.prisma`.
   - **Schema changes**: Apply using `pnpm --filter @gobid/api db:generate` and `pnpm --filter @gobid/api db:push`. Prefer `db push` over migrations unless explicitly asked.
3. **Frontend BFF Cookie Proxies**: `apps/admin` and `apps/web` use Next.js App Router route handlers (`app/api/[...path]/route.ts`) as BFF proxies.
   - **No direct Prisma in UI trees**: Web and Admin must NEVER instantiate Prisma or connect to Postgres directly.
   - **HttpOnly Cookies**: Web and Admin store JWT access and refresh tokens in HttpOnly, SameSite=Lax cookies.
4. **Shared Contracts**: `packages/shared` (`@monorepo/shared`) exports Zod schemas and TypeScript types shared by API and frontends.
   - NestJS DTO validation (`class-validator`) must stay strictly aligned with shared Zod schema bounds.
5. **Package Manager**: Use **`pnpm`** exclusively (`pnpm install`, `pnpm --filter <app> <script>`).
6. **Native iOS Client**: `ios-app/` is a native SwiftUI client communicating directly with the NestJS API via `Authorization: Bearer <token>` (with Keychain-backed refresh).

---

## 🗺️ Documentation Directory Map

Detailed technical documentation lives under [`/docs`](docs/):

| Document | Description |
|----------|-------------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Monorepo layout, technology stack matrix, system flow diagram, BFF proxy mechanics |
| [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md) | Domain entities, relations, Prisma model reference, formal state machines |
| [`docs/API_GUIDE.md`](docs/API_GUIDE.md) | REST API conventions, `{ data }` / `{ error }` envelopes, HTTP status codes, pagination, rate limits |
| [`docs/AUTH_AND_SECURITY.md`](docs/AUTH_AND_SECURITY.md) | JWT auth lifecycle, BFF cookies, CSRF protection, iOS Keychain, HMAC upload signing, RBAC |
| [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) | Prisma schema reference, `db push` workflow, indexes, seed data, retention policies |
| [`docs/WEB_APP_GUIDE.md`](docs/WEB_APP_GUIDE.md) | Next.js 16 web app architecture, React Query hooks, BFF proxies, Tailwind CSS v4 |
| [`docs/ADMIN_APP_GUIDE.md`](docs/ADMIN_APP_GUIDE.md) | Next.js 16 admin dashboard, shadcn/ui components, binary `ADMIN` role vs UI permissions |
| [`docs/MOBILE_APP_GUIDE.md`](docs/MOBILE_APP_GUIDE.md) | iOS SwiftUI architecture, MapKit, Keychain auth, token refresher queue |
| [`docs/SHARED_CONTRACTS.md`](docs/SHARED_CONTRACTS.md) | `@monorepo/shared` package structure, exporting Zod schemas, contract synchronization |
| [`docs/JOBS_AND_REDIS.md`](docs/JOBS_AND_REDIS.md) | BullMQ cron token cleanup, Redis rate limiting, Socket.IO Redis adapter |
| [`docs/REALTIME.md`](docs/REALTIME.md) | Socket.IO architecture, rooms, auth, publisher, client integration |
| [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md) | Environment setup, pnpm workspace scripts, Docker Postgres/Redis, troubleshooting |
| [`docs/TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md) | Vitest and Jest testing strategies, integration testing, CI quality gates |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Docker build targets, production domain configuration, database backups, health probes |

---

## 📝 Conventions & Coding Standards

- **Conventional Commits**: `feat(scope): ...`, `fix(scope): ...`, `refactor(scope): ...`, `docs(scope): ...`.
- **Validation**: Validate at boundary layers with Zod (clients & shared) and `class-validator` / `class-transformer` (Nest DTOs).
- **Errors**: Throw `AppError` subclasses or standard NestJS exceptions on backend; catch and present user-friendly error messages on frontends.
- **Environment & Secrets**: Never commit `.env` or hardcoded credentials. Use `.env.example` templates for configuration.
- **Scope**: Minimize change scope to match existing patterns and prevent unexpected regressions.

---

## ⚙️ Essential Commands

```bash
# Start infrastructure (Postgres :5433, Redis :6380)
pnpm --filter @gobid/api docker:up

# Schema & Seed
pnpm --filter @gobid/api db:generate
pnpm --filter @gobid/api db:push
pnpm --filter @gobid/api db:seed

# Development
pnpm dev:api      # NestJS API (http://localhost:3000)
pnpm dev:admin    # Admin Panel (http://localhost:3001)
pnpm dev:web      # Web Marketplace (http://localhost:3002)

# Quality Checks
pnpm typecheck    # TypeScript build verification across all packages
pnpm lint         # Lint check across monorepo
```
