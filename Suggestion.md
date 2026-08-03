# API production-readiness audit

## Executive summary

The NestJS API has a solid base: strict DTO validation, structured errors, JWT refresh-token
rotation, private message-upload authorization, request IDs, and Prisma relations are already in
place. This audit hardens the highest-impact production risks without changing the public success
envelope.

## Fixed issues

| Issue | Why it mattered | Resolution |
| --- | --- | --- |
| 80 MB JSON and form limits | Small requests could exhaust application memory | Reduced both global parsers to 2 MB. Multipart endpoints retain their route-specific upload limits. |
| Swagger always public | Exposed API inventory and schemas in production | Swagger is disabled in production unless `ENABLE_SWAGGER=true`. |
| Placeholder JWT secret accepted | The documented sample secret could sign production tokens | Production startup rejects the placeholder secret. |
| Production could silently use local upload storage | Persistent local disks are unsafe across replicas and can expose files | Production requires complete Spaces credentials and rejects `UPLOAD_STORAGE=local`. Explicit Spaces mode now rejects incomplete credentials in every environment. |
| Database TLS was opt-in | Managed Postgres could run without certificate validation | Non-local production databases now use TLS with certificate verification by default; the existing explicit opt-out remains available for exceptional providers. |
| Device token ownership could be transferred | A caller with another account's push token could reassign that device | Registration refuses tokens owned by another user and update paths never mutate `userId`. |
| Public request search exposed terminal states | Completed/cancelled requests could be enumerated through the public feed | Public listing accepts only `OPEN`; non-public statuses receive a validation error. |
| Password reset submission lacked endpoint rate limiting | A reset token endpoint could be abused for CPU work and account probing | Added the credential rate limiter to reset submissions. |
| Production password resets had no delivery path | Tokens were stored but no production recipient received a reset link | Added a focused Resend email provider, 10-second timeout, failure handling, and production requirements for `RESEND_API_KEY` and `EMAIL_FROM`. Tokens are never returned when a mail provider is configured. Development retains the explicit local reset-link response when mail is not configured. |
| Sensitive admin mutations lacked audit records | Offer and review moderation actions were not traceable | Offer update/delete and review delete now record actor, resource, and relevant prior details. Review deletion, aggregate recalculation, and audit write execute atomically. |
| Production Compose had dangerous defaults | It defaulted to a known JWT secret, local uploads, seed-on-start, and public operational assumptions | Production Compose requires deployment secrets/Spaces settings, disables seeding and Swagger, and adds an API health check. |
| Tests required undocumented shell environment | A normal `pnpm test` failed before the suite loaded Prisma | Added a generated-client pretest step and Vitest defaults for test-only database/JWT values. |
| Missing regression coverage | Device-ownership and public-status policies could regress silently | Added focused unit tests for both rules. |
| Vulnerable Swagger transitive dependency | `js-yaml@5.2.1` was flagged by the production dependency audit | Added a pnpm 11 workspace override to resolve the Swagger dependency to `js-yaml@5.2.2`. |

## Performance improvements made

- Prevented oversized JSON/form parsing before business logic runs.
- Kept public list queries bounded to open records, reducing unnecessary scans and information
  disclosure.
- Kept review aggregate recalculation in the same database transaction as deletion, avoiding an
  inconsistent rating window.

## Security improvements made

- Hardened production configuration, storage, TLS, Swagger exposure, secrets, reset delivery,
  device registration, request visibility, rate limits, and audit trails.
- Preserved existing parameterized Prisma queries and ownership checks; no raw user input is used
  for SQL construction.

## Refactoring summary

- Added a small `EmailModule` with a single responsibility: delivery of password-reset emails.
- Kept controllers thin by passing authenticated actor IDs to the existing admin service.
- Centralized production startup safety checks in the environment module.

## Remaining recommendations

These are valid follow-up work but require product or infrastructure decisions rather than safe
in-place API changes:

1. Implement email verification before activation if account trust requires it.
2. Implement APNs/FCM delivery or remove the device-registration API; notifications are currently
   persisted in-app only.
3. Add Redis to readiness checks and require it for all multi-instance deployments. The existing
   `RATE_LIMIT_ALLOW_MEMORY=true` exception remains intentionally available for a documented
   single-node deployment.
4. Add cursor pagination to high-volume request, notification, conversation, and admin listings;
   current offset pagination is bounded but degrades for deep pages.
5. Add an upload-orphan cleanup job after deciding retention policy and object-store lifecycle
   rules.
6. Add integration tests for auth rotation/reuse, authorization boundaries, private upload access,
   and transactional request state transitions against an ephemeral Postgres instance.
7. Consolidate the duplicate API Dockerfiles/lockfile strategy after selecting the canonical
   deployment build context.
8. Review the separate admin application dependency audit. Remaining reported production
   vulnerabilities are in its Next.js dependency tree (`sharp`/`postcss`), not the API runtime.

## Files modified

- `apps/api/.env.example`
- `apps/api/README.md`
- `apps/api/package.json`
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/devices/devices.service.ts`
- `apps/api/src/devices/devices.service.test.ts`
- `apps/api/src/email/email.module.ts`
- `apps/api/src/email/email.service.ts`
- `apps/api/src/lib/env.ts`
- `apps/api/src/main.ts`
- `apps/api/src/prisma/prisma.service.ts`
- `apps/api/src/requests/requests.dto.ts`
- `apps/api/src/requests/requests.service.ts`
- `apps/api/src/requests/requests.service.test.ts`
- `apps/api/tsconfig.json`
- `apps/api/vitest.config.ts`
- `apps/api/vitest.setup.ts`
- `docker-compose.yml`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`

## Breaking changes

- Production now fails fast unless Spaces and Resend credentials are configured.
- `/docs` is no longer available in production unless `ENABLE_SWAGGER=true`.
- `GET /requests` rejects statuses other than `OPEN`.
- A device token may no longer be reassigned across accounts.
- Root production Compose requires explicit deployment secrets rather than insecure defaults.
