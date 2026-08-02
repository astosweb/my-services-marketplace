# AGENTS.md

Guidance for AI agents working in this repository.

Monorepo-wide **Project Standards** (architecture, Zod, API contracts, no DB from the frontend, Prisma practices) live in the root [`AGENTS.md`](../../AGENTS.md). Follow those in addition to the admin-specific notes below.

## Project overview

Next.js 16 admin panel with PostgreSQL via Prisma 7. Early-stage scaffold — extend it incrementally; match existing patterns before introducing new abstractions.

| Layer | Stack |
|-------|-------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Language | TypeScript (strict) |
| Database | PostgreSQL + Prisma 7 (`@prisma/adapter-pg`) |
| Package manager | **pnpm** (not npm/yarn) |

## Setup

```bash
pnpm install
cp .env.example .env   # if present; otherwise create .env with DATABASE_URL
pnpm db:generate
pnpm exec prisma db push   # preferred over migrate (see Database)
pnpm dev               # http://localhost:3001
```

Required env var: `DATABASE_URL` (PostgreSQL connection string). Never commit `.env` files.

## Project structure

```
app/                    # Next.js App Router (pages, layouts, route handlers)
  generated/prisma/     # Prisma client output (gitignored — regenerate after schema changes)
  globals.css           # Tailwind v4 entry + theme tokens
lib/
  prisma.ts             # Singleton Prisma client (use this everywhere)
prisma/
  schema.prisma         # Database schema
scripts/                # One-off CLI scripts (run with tsx)
public/                 # Static assets
```

Path alias: `@/*` maps to the repo root (e.g. `import { prisma } from "@/lib/prisma"`).

## Database

- **Schema changes**: edit `apps/api/prisma/schema.prisma`, then run `pnpm db:generate` and `pnpm db:push` (from admin or api). Do **not** use `pnpm db:migrate` unless explicitly asked.
- **Client import**: generated client lives at `app/generated/prisma/client` — always go through `@/lib/prisma`, never instantiate `PrismaClient` elsewhere.
- **Driver**: uses `@prisma/adapter-pg` with `pg`; connection string comes from `DATABASE_URL`.
- **Scripts**: run ad-hoc DB scripts with `pnpm tsx scripts/<name>.ts` (see `scripts/script.ts` for the pattern: import prisma, disconnect in `finally`/`.catch`).

When adding models, keep names PascalCase, fields camelCase, and add indexes/constraints where queries will filter or join.

## Next.js conventions

- **App Router only** — no `pages/` directory.
- **Server Components by default**; add `"use client"` only when the component needs hooks, browser APIs, or event handlers.
- **Route handlers** go in `app/api/<route>/route.ts` with named exports (`GET`, `POST`, etc.).
- **Server Actions** (if used): colocate in `actions/` or next to the feature; validate input at the boundary.
- **Metadata**: set page-level `metadata` exports or `generateMetadata` in layouts/pages.
- **Images**: use `next/image` for local/remote images; configure `remotePatterns` in `next.config.ts` when adding external domains.
- **Fonts**: Geist Sans/Mono loaded in `app/layout.tsx` via `next/font/google` — reuse CSS variables `--font-geist-sans` / `--font-geist-mono`.

## UI & styling

- **Tailwind CSS v4** — configured via `app/globals.css` (`@import "tailwindcss"`, `@theme inline`). No `tailwind.config.js`.
- Use existing design tokens: `bg-background`, `text-foreground`, zinc palette, dark mode via `prefers-color-scheme`.
- Prefer utility classes over custom CSS. Keep layouts responsive with the `sm:` / `md:` patterns already in `app/page.tsx`.
- Prettier + `prettier-plugin-tailwindcss` are available — run formatting before committing UI changes.

## TypeScript & code style

- `strict: true` — no `any` unless unavoidable; prefer explicit types on public APIs.
- Prefer **async/await**, short focused functions, and small single-purpose components.
- Keep business logic out of UI; validate inputs with **Zod** at boundaries (`lib/validations`, actions, API clients).
- Data access goes through `lib/api/*` React Query hooks (typed against `@monorepo/shared`) — never `fetch` inside a component, and no new Prisma usage in UI trees.
- **Minimize scope** — smallest correct diff; don't refactor unrelated code.
- **Reuse before inventing** — extend existing components and `lib/` utilities; avoid one-off helpers.
- **No over-engineering** — no premature abstractions, wrappers, or error handling for impossible edge cases.
- **Comments** — only for non-obvious business logic; prefer clear names over inline comments.
- **Tests** — Vitest (`pnpm test`); cover meaningful behaviour such as the API client, auth helpers and rate limiting.

## Linting & build

```bash
pnpm lint      # ESLint (eslint-config-next)
pnpm build     # Production build — run before finishing larger changes
```

Fix all lint errors in touched files. ESLint ignores `.next/`, `out/`, `build/`, and generated Prisma output.

## Git & commits

- **Only commit when explicitly asked.**
- Use Conventional Commits: `feat(scope): …`, `fix(scope): …`, `refactor(scope): …`.
- Focus commit messages on *why*, not just *what*.
- Never commit secrets (`.env`, credentials). Never force-push to `main`.
- PRs should include: problem/solution summary, linked issue if applicable, screenshots for UI changes, and notes on env or schema impacts.

## Agent workflow

1. Read surrounding code before editing — match naming, imports, and patterns.
2. After Prisma schema changes: `pnpm db:generate` then `pnpm db:push`.
3. Verify with `pnpm lint` and `pnpm build` when changes are non-trivial.
4. Don't create README/docs/markdown files unless requested.
5. Don't add dependencies without a clear need; prefer what's already installed.
6. Use `pnpm` for all package and script commands.

## Common tasks

| Task | Command / location |
|------|-------------------|
| Add a page | `app/<segment>/page.tsx` |
| Add API endpoint | `app/api/<segment>/route.ts` |
| Add DB model | `apps/api/prisma/schema.prisma` → generate → push |
| DB GUI | `pnpm db:studio` |
| Kill dev ports | `pnpm killport` |
| Run a script | `pnpm tsx scripts/<file>.ts` |

## Pitfalls to avoid

- Importing `PrismaClient` directly instead of `@/lib/prisma`.
- Accessing the database from client components — keep Prisma server-side and prefer the NestJS API for new data features.
- Forgetting to regenerate the client after schema edits (`app/generated/prisma` is gitignored).
- Using `prisma migrate` when `db push` is the project standard.
- Adding `"use client"` to entire page trees when only a leaf component needs it.
- Committing `pnpm-lock.yaml` is intentionally gitignored in this repo — do not add it unless the user changes that policy.
