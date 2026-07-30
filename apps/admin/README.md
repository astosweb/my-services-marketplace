# Hero Admin

Next.js admin panel for the Hero marketplace API.

## Stack

- Next.js 15 (App Router)
- Tailwind CSS 4
- Shadcn-style layout (sidebar + data tables)

## Setup

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Admin UI: `http://localhost:3001`

Requires the API running at `NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:3000`).

## Auth

Only users with `role=ADMIN` can sign in via `POST /admin/auth/login`.

Seed credentials after `pnpm db:seed` in the API:

- email: `admin@hero.test`
- password: `password123`

## Features

- Dashboard metrics
- Users: search, disable, promote/demote admin, revoke sessions, delete
- Requests: moderate status/premium/content, delete
- Offers: inspect bids
- Reviews: delete abusive reviews (recalculates ratings)
- Categories: CRUD
