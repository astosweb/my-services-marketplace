# Migration Log — Dependency & Platform Modernization

## Summary

Upgraded the Hero API to the latest stable toolchain and dependency versions, migrated deprecated Zod 4 APIs, hardened security defaults, and added modern lint/format/test tooling. Public HTTP APIs and response shapes are unchanged.

## Dependency upgrades

| Package                                            | From                   | To                                                     | Notes                                           |
| -------------------------------------------------- | ---------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| `prisma` / `@prisma/client` / `@prisma/adapter-pg` | 7.9.0                  | **7.9.1**                                              | Patch release                                   |
| `@aws-sdk/client-s3`                               | 3.1095.0               | 3.1095.0                                               | Already latest                                  |
| `hono` / `@hono/node-server`                       | 4.12.32 / 2.0.12       | same                                                   | Already latest                                  |
| `zod`                                              | 4.4.3                  | 4.4.3                                                  | Already latest; APIs migrated                   |
| `jose`, `bcryptjs`, `dotenv`, `pg`, `tsx`          | current                | latest                                                 | Already on latest stable                        |
| TypeScript (build)                                 | 7.0.2 via `typescript` | **7.0.2** via `@typescript/native`                     | Official side-by-side layout                    |
| TypeScript (tooling API)                           | —                      | **6.0.2** via `typescript` → `@typescript/typescript6` | Required for typescript-eslint until TS 7.1 API |
| ESLint                                             | —                      | **10.8.0**                                             | Flat config                                     |
| `typescript-eslint`                                | —                      | **8.65.0**                                             | Type-checked rules                              |
| Prettier                                           | —                      | **3.9.6**                                              |                                                 |
| Vitest                                             | —                      | **4.1.10**                                             |                                                 |

### Removed

- `@types/bcryptjs` — abandoned stub; `bcryptjs@3` ships its own types.

## TypeScript 7 + ESLint side-by-side

TypeScript 7.0 has no stable programmatic compiler API (expected in 7.1). `typescript-eslint` therefore cannot import `typescript@7` directly.

Per [Microsoft’s guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0):

```json
{
  "devDependencies": {
    "@typescript/native": "npm:typescript@^7.0.2",
    "typescript": "npm:@typescript/typescript6@^6.0.2"
  }
}
```

- Builds / typecheck use **`tsc` from TypeScript 7** (`@typescript/native`).
- ESLint uses the **TypeScript 6 API** re-exported by `@typescript/typescript6`.

When TypeScript 7.1 ships a stable API and typescript-eslint supports it, remove the `@typescript/typescript6` alias and depend on `typescript@^7` directly.

## Config changes

- **`tsconfig.json`**: stricter options (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`, `noImplicitOverride`, `forceConsistentCasingInFileNames`).
- **`tsconfig.build.json`**: emit-only config for `src/` (excludes tests).
- **`eslint.config.js`**: flat config + type-checked recommended rules + Prettier compatibility.
- **`.prettierrc.json`**: project formatter defaults.
- **`vitest.config.ts`**: Node test runner.
- **`package.json`**: `engines` (Node ≥22, pnpm ≥10), `packageManager`, lint/format/test/typecheck scripts.
- **`pnpm-workspace.yaml`**: explicit single-package workspace + `allowBuilds`.
- **`.gitignore`**: now ignores `.env`, coverage, generated client, `.data`.

## Zod 4 API migrations

| Deprecated              | Replacement        |
| ----------------------- | ------------------ |
| `z.string().email()`    | `z.email()`        |
| `z.string().url()`      | `z.url()`          |
| `z.string().datetime()` | `z.iso.datetime()` |
| `z.nativeEnum(X)`       | `z.enum(X)`        |

Shared `parseOrThrow` / `formatZodError` in `src/lib/validate.ts` replace duplicated flatten-only error messages with field-aware 400s.

## Security & runtime hardening (non-breaking)

- Hono **`secureHeaders()`** on all routes.
- Global **`bodyLimit`** (20 MB) with `413 PAYLOAD_TOO_LARGE`.
- Configurable **`CORS_ORIGIN`** (default `*` for backward compatibility).
- Upload key ownership checks for `photoKeys` (`requests/{userId}/…`) and message `attachmentKey` (`messages/{userId}/…`).
- Safer local file serving (reject `..`, absolute paths, and paths outside `.data/uploads`).
- Avatar keys: reject path traversal only (no avatar upload namespace yet).

## New developer scripts

```bash
pnpm typecheck
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
pnpm test
pnpm test:watch
```

## Verification

- `pnpm lint` — pass
- `pnpm test` — pass (8 tests)
- `pnpm typecheck` — pass
- `pnpm build` — pass
- `pnpm audit` — no known vulnerabilities

## Versioned Prisma migrations (production)

Baseline migration: `prisma/migrations/20260728195000_init` (full schema from empty DB).

| Environment | Command | Notes |
| --- | --- | --- |
| Production / CI | `pnpm db:migrate:deploy` | Apply committed migrations only |
| Local schema change | `pnpm db:migrate` | Creates SQL under `prisma/migrations/` and applies |
| Throwaway prototype | `pnpm db:push` | No history — do not use in prod |

After deploy, `pnpm db:migrate:status` should report the database in sync. Existing databases that were created with `db:push` can be baselined with `prisma migrate resolve --applied 20260728195000_init` once the schema already matches, then use migrate going forward.
