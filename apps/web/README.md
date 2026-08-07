# Gobid Web Marketplace (`apps/web`)

Public Next.js web application for the **Gobid Local Services Marketplace**.

## Stack

- Next.js 16 (App Router), React 19
- Tailwind CSS v4
- TanStack Query (React Query v5)
- Zod + React Hook Form
- BFF HttpOnly JWT cookie proxying against `@gobid/api`

## Getting Started

```bash
# Ensure API is running on http://localhost:3000
cp .env.example .env
pnpm dev:web   # http://localhost:3002
```

## Features

- **Marketplace Browsing**: Filter service requests by city (Tallinn, Tartu, Pärnu, Narva) and category.
- **Request Creation**: Step-by-step service request posting wizard.
- **Bidding & Offers**: Submit quotes on requests, review incoming offers, accept/decline bids.
- **Job Progress Tracking**: Interactive milestone execution steps (`ON_THE_WAY`, `STARTED`, `PROVIDER_DONE`, `OWNER_CONFIRMED`).
- **Messaging**: Direct messaging and per-request chat threads.
- **Reviews**: Post ratings (1–5 stars) and comments after job completion.
- **Customer Support Desk**: User ticket creation, tracking, and messaging.

## Documentation Reference

See [`docs/WEB_APP_GUIDE.md`](../../docs/WEB_APP_GUIDE.md) for detailed architecture, route handling, and state management patterns.
