# Web Marketplace Application Guide (`apps/web`)

## Overview

The **Web Marketplace Application** (`apps/web`) is a modern Next.js 16 (App Router) frontend serving requesters and service providers across Estonia.

---

## Architecture & Directory Layout

```
apps/web/
├── app/
│   ├── (auth)/            # Auth routes: sign-in, register, forgot-password
│   ├── (dashboard)/       # User dashboard, my requests, active jobs, inbox
│   ├── (public)/          # Landing page, browse requests, request details
│   ├── api/               # BFF proxy handlers: [...path]/route.ts & auth endpoints
│   ├── layout.tsx         # Root layout with QueryClientProvider & AuthProvider
│   └── page.tsx           # Landing homepage
├── components/            # Reusable UI components & layouts
├── hooks/                 # Custom React hooks
├── lib/
│   ├── api/               # TanStack Query API hooks connecting to /api/*
│   └── auth/              # Cookie management, session state, CSRF utilities
└── vitest.config.ts       # Vitest unit test setup
```

---

## BFF Route Handler Architecture (`app/api/[...path]/route.ts`)

The Web application relies entirely on BFF proxy handlers to interact with NestJS API:

1. **Browser** sends requests to `http://localhost:3002/api/requests`.
2. **Next.js Route Handler** catches the request, checks Same-Origin CSRF headers for mutating methods (`POST`, `PATCH`, `DELETE`), extracts `access_token` from HttpOnly cookies, and forwards the call to `http://localhost:3000/requests` with `Authorization: Bearer <token>`.
3. If NestJS returns `401 Unauthorized`, the route handler invokes `POST /auth/refresh` using the `refresh_token` cookie, sets updated cookies on the response, and retries the original request once.

---

## State Management & Data Fetching

- **Server State**: Managed via **TanStack Query (React Query)**. All API hooks live under `lib/api/` (e.g. `useRequests`, `useOffers`, `useConversations`).
- **Form State**: Handled by **React Hook Form** paired with `@hookform/resolvers/zod` referencing schemas exported from `@monorepo/shared`.
- **Client Session**: Provided by `AuthProvider` wrapping session check `GET /api/auth/session`.
