# AGENTS.md — Shared Package (`packages/shared`)

Guidance for AI agents working on **Shared Contracts & Validation Schemas** (`packages/shared`).

Monorepo architecture standards live in the root [`AGENTS.md`](../../AGENTS.md).

---

## Technical Stack & Role

- **Package Name**: `@monorepo/shared`
- **Stack**: TypeScript, Zod.
- **Role**: Serves as the single source of truth for API request/response contracts, Zod validation schemas, and TypeScript interfaces consumed by Web, Admin, and API layers.

---

## 🔑 Key Coding Invariants

1. **No Backend Dependencies**: `packages/shared` MUST NOT import `@prisma/client`, NestJS modules, or Node-only server libraries.
2. **Align with Nest DTO Limits**: Ensure string lengths (`min`/`max`), numeric bounds, and enum definitions in Zod schemas match NestJS `class-validator` DTOs exactly.
3. **Export All Modules**: Export new contract modules from `packages/shared/src/index.ts`.
4. **Immutability**: Avoid breaking changes to exported contract interfaces that could break client builds or mobile API consumers.

---

## 🛠️ Essential Commands

```bash
# From packages/shared directory or root
pnpm --filter @monorepo/shared build       # Compile TypeScript contracts
pnpm --filter @monorepo/shared typecheck   # Typecheck shared library
```
