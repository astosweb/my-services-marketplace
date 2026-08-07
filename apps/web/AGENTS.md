# AGENTS.md — Web Marketplace (`apps/web`)

Guidance for AI agents working on the **Web Marketplace Frontend** (`apps/web`).

Monorepo architecture standards live in the root [`AGENTS.md`](../../AGENTS.md).

---

## Technical Stack & Architecture

| Layer | Stack |
|-------|-------|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS v4 |
| Data Fetching | TanStack Query (React Query) + `@monorepo/shared` |
| Auth & Proxy | Next.js BFF App Router Route Handlers (`app/api/[...path]/route.ts`) + HttpOnly Cookies |
| Forms | React Hook Form + Zod (`@monorepo/shared`) |

---

## 🔑 Key Coding Invariants

1. **No Prisma in Web UI**: Web application must NEVER import `@prisma/client` or connect to Postgres directly.
2. **Use BFF Route Proxy**: All network requests pass through `/api/*` route handlers which manage HttpOnly JWT cookies and CSRF checks.
3. **Data Fetching Hooks**: Use React Query hooks located under `lib/api/*` or custom hooks under `hooks/`. Do not write raw `fetch()` calls inside UI components when a hook exists.
4. **Form Validation**: Validate forms using React Hook Form resolver bound to shared Zod schemas from `@monorepo/shared`.
5. **Styling & Aesthetics**: Follow modern, clean design aesthetics using Tailwind v4. Support dark mode and responsive mobile layouts.

---

## 🛠️ Essential Commands

```bash
# From repo root
pnpm dev:web       # Start Web marketplace in dev mode (:3002)
pnpm build:web     # Production build
pnpm --filter web typecheck # Run TypeScript check
pnpm --filter web test      # Run Vitest tests
```
