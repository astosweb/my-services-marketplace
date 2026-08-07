# AGENTS.md — NestJS API (`apps/api`)

Guidance for AI agents working on the **NestJS Core API** (`apps/api`).

Monorepo architecture standards live in the root [`AGENTS.md`](../../AGENTS.md).

---

## Technical Stack & Architecture

- **Framework**: NestJS 11, Node 22 LTS, TypeScript 6.
- **Database**: PostgreSQL 18 via Prisma 7 ORM (`prisma/schema.prisma`).
- **Cache & Jobs**: Redis 8, BullMQ 5.
- **Auth**: Passport JWT strategy (`JwtAuthGuard` applied globally), bcrypt hashing.

---

## 🔑 Key Coding Invariants

1. **Global Auth Guard**: All routes require valid JWT authentication by default. Use the `@Public()` decorator to mark endpoints public (e.g. `/health`, `/auth/login`, `/categories`).
2. **Admin Role Guard**: Admin endpoints under `/admin/*` must enforce `role === 'ADMIN'` via `AdminGuard`.
3. **Validation Pipes**: DTOs use `class-validator` and `class-transformer`. Keep constraints aligned with `@monorepo/shared` Zod schemas.
4. **Error Handling**: Use standard Nest exceptions (`NotFoundException`, `ForbiddenException`, `BadRequestException`) or throw `AppError` subclasses. Never return raw 500 error objects or unhandled Prisma errors to clients.
5. **Prisma Operations**: Perform complex data modifications inside `prisma.$transaction([])` or `prisma.$transaction(async tx => ...)` to ensure atomicity.
7. **Realtime**: Do not put business logic in the Socket.IO gateway. Emit via `RealtimePublisher` from services after durable writes. See [`docs/REALTIME.md`](../../docs/REALTIME.md).

---

## 🛠️ Essential Commands

```bash
# From apps/api directory or repo root
pnpm --filter @gobid/api dev          # Start Nest API in watch mode (:3000)
pnpm --filter @gobid/api build        # Compile Nest application
pnpm --filter @gobid/api test         # Run API unit tests (Jest)
pnpm --filter @gobid/api db:generate  # Generate Prisma client
pnpm --filter @gobid/api db:push      # Push schema to database
pnpm --filter @gobid/api db:seed      # Seed test database
```
