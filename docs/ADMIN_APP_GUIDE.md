# Admin Ops Dashboard Guide (`apps/admin`)

## Overview

The **Admin Dashboard** (`apps/admin`) is a Next.js 16 (App Router) operational interface built for platform administrators and support staff.

---

## Technical Stack & Architecture

- **Framework**: Next.js 16 (App Router), React 19.
- **UI & Styling**: Tailwind CSS v4, shadcn/ui.
- **Data & Auth**: NestJS API via TanStack Query + BFF HttpOnly JWT cookies.
- **Command Palette**: ⌘K global search for quick navigation across ops views.

---

## Directory Structure

```
apps/admin/
├── app/
│   ├── (auth)/            # Admin sign-in & password recovery
│   ├── (dashboard)/       # Dashboard metrics, moderation, users, support desk
│   └── api/               # BFF proxy handlers + auth routes
├── components/            # shadcn/ui components & admin data tables
├── config/
│   └── navigation.ts      # Sidebar navigation & permission string configuration
├── lib/
│   ├── api/               # TanStack Query API hooks -> /api/*
│   └── auth/              # Cookie guards & session context
```

---

## Binary Server RBAC vs UI Navigation Permissions

> [!IMPORTANT]
> The platform uses a **strict binary server-side RBAC model** (`USER` vs `ADMIN`).

- **Server-Side Security**: All `/admin/*` API endpoints require the user to have `role === 'ADMIN'`, enforced by NestJS `AdminGuard`.
- **UI Navigation Gating**: UI permission strings defined in `config/navigation.ts` (e.g. `users:read`, `support:write`) are used solely to customize sidebar navigation links and button visibility for staff sub-roles in the interface. They do NOT replace server-side `ADMIN` role validation.

---

## Key Features & Operations

1. **Dashboard Overview (`GET /admin/dashboard/stats`)**: Real-time metrics for total users, open requests, completed jobs, active support tickets.
2. **Request Moderation**: Review pending listings (`PENDING_REVIEW`), approve/reject requests, delete fraudulent listings.
3. **User Management**: View user profiles, review history, ban/unban user accounts, invalidate user sessions & device push tokens.
4. **Support Desk (`/admin/support`)**: Support ticket queue, ticket assignment to agents, internal staff notes (`SupportNote`), canned response templates (`CannedResponse`), bulk ticket actions.
5. **System Diagnostics (`GET /admin/system/status`)**: Live probe monitoring database connection pool and Redis cache status.
