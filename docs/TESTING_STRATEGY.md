# Testing Strategy & Quality Gates

## Overview

Gobid enforces quality gates across the monorepo using **Jest** (NestJS API unit & integration tests) and **Vitest** (Web and Admin Next.js unit tests).

---

## 1. Test Suite Breakdown

| Scope | Runner | Location | Purpose & Coverage |
|-------|--------|----------|--------------------|
| **NestJS API** | Jest | `apps/api/src/**/*.spec.ts` | Auth service, request state machine rules, upload signing, support tickets |
| **Web App** | Vitest | `apps/web/**/*.test.ts` | BFF CSRF protection, route handlers, hook logic |
| **Admin App** | Vitest | `apps/admin/**/*.test.ts` | Auth cookie guards, permission logic, data formatting |
| **Shared Contracts** | Vitest | `packages/shared/**/*.test.ts` | Zod validation schemas vs DTO bounds |

---

## 2. Running Tests

```bash
# Run NestJS API unit tests
pnpm --filter @gobid/api test

# Run Web app Vitest tests
pnpm --filter web test

# Run Admin panel Vitest tests
pnpm --filter admin-panel test

# Run contract tests
pnpm --filter @monorepo/shared test
```

---

## 3. CI Pipeline Quality Gates (`.github/workflows/`)

Pull requests must pass the following continuous integration workflow before merging:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck` (strict TypeScript validation across all workspaces)
3. `pnpm lint` (ESLint verification)
4. Execution of Jest and Vitest test suites across `@gobid/api`, `admin-panel`, and `web`.
