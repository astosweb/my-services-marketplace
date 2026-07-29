# Hero Web

Next.js web client for the Hero marketplace API (companion to the iOS app).

## Features

- Marketing landing with live **open requests**
- Explore browse (city / category / search)
- Request detail
- Auth: register, login, password reset (`PASSWORD_RESET_URL` → `:3001/reset-password`)
- Post a new request (authenticated)

## Setup

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_URL / API_URL → http://localhost:3000

pnpm install
pnpm dev   # http://localhost:3001
```

Run the API from `../api` (`pnpm dev`) and seed data (`pnpm db:seed`) so the landing page shows real requests. If the API is down, the landing falls back to sample requests.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Dev server on port **3001** |
| `pnpm build` | Production build |
| `pnpm start` | Serve production build on **3001** |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check |
