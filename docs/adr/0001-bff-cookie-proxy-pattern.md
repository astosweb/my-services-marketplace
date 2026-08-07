# ADR 0001: Backend-for-Frontend (BFF) Cookie Proxy Pattern

- **Status**: Accepted
- **Date**: 2026-08-05

## Context

The Gobid monorepo features two Next.js web applications (`apps/web` and `apps/admin`) and a standalone NestJS API (`apps/api`). Storing JWT access tokens in browser `localStorage` or `sessionStorage` leaves applications vulnerable to Cross-Site Scripting (XSS) token theft. Furthermore, instantiating database connections directly inside Next.js UI components breaks clean architecture boundaries.

## Decision

We adopt a **Backend-for-Frontend (BFF) Cookie Proxy Pattern**:

1. Web and Admin applications communicate with NestJS API exclusively through Next.js App Router API route handlers (`app/api/[...path]/route.ts`).
2. Authentication tokens (`access_token`, `refresh_token`) are stored in `HttpOnly`, `SameSite=Lax` cookies.
3. The BFF proxy validates Same-Origin CSRF headers on mutating requests (`POST`, `PATCH`, `DELETE`), extracts the token from cookies, attaches `Authorization: Bearer <accessToken>` to upstream requests, and manages single-shot token refresh on 401 response challenges.
4. Neither Web nor Admin applications import `@prisma/client` or connect to PostgreSQL directly.

## Consequences

- **Positive**: Complete XSS token theft mitigation; zero database connection pooling issues on frontend serverless/edge layers; clear architectural boundary.
- **Negative**: Adds a thin network proxy hop for browser frontend requests.
