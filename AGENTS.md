# AGENTS.md

Guidance for AI agents working in this repository.

## Architecture (do not contradict)

- **Single API:** NestJS in `apps/api` owns auth, marketplace, support, uploads, and admin routes.
- **Single schema:** `apps/api/prisma/schema.prisma`. Prefer `prisma db push` (not migrate) unless asked.
- **Frontends:** `apps/admin` and `apps/web` use BFF cookie proxies — no Prisma from UI trees.
- **Shared contracts:** `packages/shared` Zod/types must stay aligned with Nest DTO limits.
- **Package manager:** pnpm only.
- **iOS:** native SwiftUI client under `ios-app/` talking Bearer JWT to the API.

## Conventions

- Conventional Commits: `feat(scope):`, `fix(scope):`, `refactor(scope):`
- Validate at boundaries with Zod (clients) / class-validator (Nest)
- Minimize scope; match existing patterns
- Never commit `.env` or secrets

## App-specific notes

See `apps/admin/AGENTS.md` for admin UI details. API setup: `apps/api/README.md`. Product overview: root `README.md`.
