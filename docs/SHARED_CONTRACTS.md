# Shared Contracts & Boundary Validation Guide

## Overview

The `@monorepo/shared` package (`packages/shared`) contains the shared TypeScript interfaces and Zod validation schemas used across all applications in the Gobid monorepo.

---

## Contract Synchronization Matrix

To ensure type-safety and contract consistency across the entire stack:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SHARED CONTRACT SOURCE                             │
│                  packages/shared/src/marketplace.ts                     │
│               export const createRequestSchema = z.object({ ... })      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌───────────────────────────────────┐               ┌───────────────────────────────────┐
│       FRONTEND VALIDATION         │               │        BACKEND VALIDATION         │
│   apps/web & apps/admin           │               │        apps/api                   │
│   React Hook Form + Zod Resolver  │               │        NestJS DTO                 │
│   zodResolver(createRequestSchema)│               │        class-validator            │
└───────────────────────────────────┘               └───────────────────────────────────┘
```

---

## Key Exported Modules

| Module | Location | Purpose | Key Exports |
|--------|----------|---------|-------------|
| `auth` | `src/auth.ts` | Credentials & session shapes | `loginSchema`, `registerSchema`, `resetPasswordSchema` |
| `marketplace` | `src/marketplace.ts` | Request, offer & review contracts | `createRequestSchema`, `createOfferSchema`, `createReviewSchema` |
| `support` | `src/support.ts` | Help desk ticket contracts | `createTicketSchema`, `createSupportMessageSchema` |
| `users` | `src/users.ts` | Profile management contracts | `updateProfileSchema`, `UserProfileResponse` |
| `api` | `src/api.ts` | Envelope & pagination wrappers | `ApiResponse<T>`, `PaginatedMeta` |
| `permissions` | `src/permissions.ts` | Staff navigation permission strings | `PERMISSIONS_CATALOG` |

---

## Rules for Updating Contracts

1. **Keep Limits Synced**: When updating field limits (e.g. `title` max length 100 chars), update both the Zod schema in `packages/shared` and the corresponding NestJS DTO class in `apps/api/src/*/dto/`.
2. **Re-export**: Always re-export newly created contract modules in `packages/shared/src/index.ts`.
3. **Run Typecheck**: Verify workspace contract compilation by executing `pnpm typecheck` from the repository root.
