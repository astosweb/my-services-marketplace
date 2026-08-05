# API Production-Readiness Audit — Suggestion Report

**Date:** 2026-08-05  
**Scope:** `apps/api` (NestJS + Prisma + Redis/BullMQ)  
**Branch:** `cursor/api-production-audit-c5fc`

---

## Executive summary

The NestJS API already had solid foundations (strict TypeScript, hashed refresh tokens, ValidationPipe whitelist, Helmet, production env asserts, AppError filter). This pass treated it as a senior production-readiness review and **fixed** critical authorization holes, data races, missing indexes, insecure defaults, logging leaks, and multi-instance gaps—not just documented them.

**Outcome:** API is meaningfully safer, faster on hot paths, and easier to operate. Lint, typecheck, and **40 unit tests** pass. Remaining work is mostly larger structural splits (god services), fine-grained RBAC enforcement, response OpenAPI schemas, and E2E coverage.

---

## Every issue found

### Critical / High (fixed)

| Issue | Why it was a problem | How it was fixed |
|-------|----------------------|------------------|
| Chat IDOR in `assertCanOpenRequestChat` | Any authenticated user could open DMs with any peer on any request | Require owner↔pending/accepted offerer relationship |
| Client-settable `isPremium` | Monetization / privilege bypass on create/update | Removed from `CreateRequestDto`; always `false` for user creates |
| Public `PENDING_REVIEW` listings | Unapproved listings visible publicly | Public list = `OPEN` + active owners only |
| Anonymous access to non-open request details | Location/progress leaked if ID known | Non-open requests require participant; pending only for owner |
| Banned user reviews still public | `GET /users/:id/reviews` ignored ban status | Same ban check as profile `get()` |
| `AdminGuard` not exported to SupportModule | DI risk for `/admin/support/*` | Moved `AdminGuard` into global `CommonModule` |
| Production localhost reset / media URLs | Live emails/media could point at localhost | Assert non-localhost `PASSWORD_RESET_URL` + `API_PUBLIC_URL` |
| Upload HMAC used `JWT_SECRET` | JWT compromise forges private upload URLs | Added `UPLOAD_SIGNING_SECRET` (required in prod) |
| Query `token`/`exp` in access logs | Signed URL secrets in Pino logs | Expanded redact paths (query, cookie, url, passwords) |
| Progress/status updates without CAS | Concurrent advances could duplicate events / wrong state | `updateMany` with expected status/progress |
| Offer withdraw / review races | Non-conditional updates; rating outside TX | Conditional `updateMany`; review+rating in one TX |
| Offer re-create after WITHDRAWN | Unique `(requestId, offererId)` blocked re-offer | Reactivate WITHDRAWN/DECLINED → PENDING |
| Token cleanup only when Redis set | Expired tokens accumulate without Redis | Always load `JobsModule`; cron cleanup without Bull |
| Redis rate-limit INCR/PEXPIRE race | Crash between ops → stuck keys without TTL | Atomic Lua script |
| Conversation inbox loaded all rows | O(n) memory; fake pagination | DB `take`/`skip` + pin order |
| Unbounded message history | Memory/latency blowups | Cap last 100 (conversations/request chat); admin 200 |
| Non-image uploads trusted client MIME | Arbitrary bytes under claimed PDF/doc types | Magic-byte sniff (`mime-sniff.ts`) |
| Support emails in end-user payloads | Staff/user emails leaked to non-admins | Email only when `viewer.isAdmin` |
| `DATABASE_SSL_REJECT_UNAUTHORIZED=false` in prod | TLS MITM on managed Postgres | Forbidden in production asserts |
| Weak JWT example / low-entropy check | Easy misconfig | Entropy check + stronger production asserts |

### Medium (fixed)

| Issue | Why it was a problem | How it was fixed |
|-------|----------------------|------------------|
| Login timing oracle | Missing user skipped bcrypt | Always compare against dummy hash |
| Register TOCTOU | Check-then-create race | Create + map `P2002` |
| Missing DB indexes | Seq scans on inbox, SLA, offers, devices, attachments | Added composite indexes in `schema.prisma` |
| Prisma pool not closed | Connection leak on shutdown | Retain `Pool`, `pool.end()` in `onModuleDestroy` |
| Health readiness opened new Redis each probe | Connection exhaustion DoS | Reuse rate-limit Redis client |
| In-memory rate-limit Map growth | Expired keys never pruned | Periodic sweep |
| Support typing in-memory only | Broken across pods | Redis sync + local fallback |
| Exception filter logged full Prisma errors | Query/params in logs | Log name/message/code only |
| Mixed Nest `HttpException` in uploads/health | Inconsistent error envelope | Use `AppError` helpers |
| Unused `@nestjs/jwt` + dead `create-prisma.ts` | Drift / dead code | Removed |
| Duplicate CSV / rating helpers | DRY violations | `lib/csv.ts`, `lib/user-rating.ts` |
| Admin ban not transactional | Brief refresh window after ban | Ban + token wipe in one TX |
| Dashboard chart loaded all rows | JS bucketing of 14d requests | SQL `date_trunc` groupBy |
| Legacy message API undocumented deprecation | Clients keep using weaker path | OpenAPI `deprecated: true` |
| Logout without rate limit | Refresh revoke abuse surface | `@RefreshRateLimit()` |
| Admin lat/long as `@IsInt @Min(0)` | Invalid geo validation | Proper `@IsNumber` bounds |
| Attachment key length unbounded | Oversized keys | `@MaxLength(500, { each: true })` |
| Non-image downloads inline | Content sniffing / XSS risk in browsers | `Content-Disposition: attachment` |
| Opt-in JWT only | Easy to ship unauthenticated private routes | Global `JwtAuthGuard` + `@Public()` |
| Device token race | Concurrent register could mutate another user's device row | Transactional ownership check |
| bcrypt >72 char passwords | False strength / truncated hash | Cap password DTOs at 72 |
| `avatarKey: null` failed validation | Could not clear avatar | `@ValidateIf` for null clears |
| Standard errors missing 429 | Incomplete OpenAPI | `ApiTooManyRequestsResponse` |

### Lower / documented honesty (fixed or annotated)

| Issue | Fix |
|-------|-----|
| Permissions catalog looked enforceable | Documented as UI-only in `admin-permissions.ts` |
| Pagination DTO duplication | Shared `common/dto/pagination.dto.ts` (available for adoption) |
| Jobs Bull connection brittle | Safer URL parse, `maxRetriesPerRequest: null`, retries/backoff |
| Retention only for auth tokens | Cleanup also deletes old notifications, inactive devices, case sequences |

---

## Security improvements made

1. Relationship-gated request chat (IDOR closed).
2. Premium flag no longer client-writable.
3. Public marketplace visibility restricted to approved open listings.
4. Banned users hidden from profile + reviews.
5. Stricter production boot asserts (URLs, SSL, upload signing secret, JWT entropy).
6. Separated upload signing secret from JWT.
7. Log redaction for signed URL query params and cookies.
8. MIME sniffing for non-image attachments.
9. Support email fields admin-only.
10. Login timing equalization; register uniqueness race handled.
11. Forced download disposition for non-image uploads.
12. Ban + session wipe atomic.
13. Global JWT by default (`@Public` escape hatch).
14. Device registration ownership race closed.

---

## Performance improvements made

1. Indexes for conversation inbox, request lists, offers, SLA queues, devices, attachment ACL lookups.
2. Conversation list paginated in DB.
3. Message history capped (request chat, conversations, admin).
4. Public request list: cover photo only (`take: 1`).
5. Dashboard chart via SQL aggregation instead of loading all rows.
6. Atomic Redis rate-limit Lua (fewer round-trips + correctness).
7. Health Redis reuse (no connect/quit per probe).
8. Token/notification/device retention jobs reduce table bloat.

---

## Refactoring summary

- **Guards:** `AdminGuard` global via `CommonModule`.
- **Auth module:** dropped unused `JwtModule` (signing stays on `jose` + Passport verify).
- **Jobs:** always-on maintenance; Bull optional when Redis present.
- **Support controllers:** no Prisma injection; typing via service methods.
- **Shared libs:** `csv`, `user-rating`, `mime-sniff`, pagination DTO.
- **Serializers:** support user email gated by viewer role.
- **Dead code:** removed `create-prisma.ts`, unused `@nestjs/jwt`.

God-service splits (`admin.service` / `support.service` / `requests.service`) were started via shared helpers and clearer boundaries; full file splits remain a follow-up to avoid risky big-bang moves in one PR.

---

## Remaining recommendations

1. **Split god services** into domain modules (offers, progress, reviews, support tickets/ops/canned).
2. **Enforce or stop advertising** fine-grained admin permissions (catalog is documented as UI-only).
3. **Cursor pagination** for feeds (requests, notifications, messages).
4. **OpenAPI response DTOs** for all success payloads.
5. **E2E tests** for offer accept, refresh reuse, private upload ACL, admin support guard.
6. **Throttler Redis storage** so Nest global throttle is multi-instance safe.
7. **Document MIME** further (OLE `.xls` vs `.doc` distinction) or restrict to PDF+images only.
8. **Outbox pattern** for notifications after transactional domain commits.
9. **Align Nest DTOs with `@monorepo/shared` Zod** to stop contract drift.

---

## Potential future improvements

- WebSocket/SSE for messaging and support typing.
- Redis-backed entity cache for categories / open request cards.
- Observability (OpenTelemetry, Sentry).
- Payments / premium monetization (premium is admin/flag only today).
- Partial unique index for pending offers if product wants multiple historical rows.
- Streaming CSV exports via Bull jobs.

---

## Files modified

### New
- `apps/api/src/common/dto/pagination.dto.ts`
- `apps/api/src/common/decorators/public.decorator.ts`
- `apps/api/src/lib/csv.ts`
- `apps/api/src/lib/user-rating.ts`
- `apps/api/src/lib/mime-sniff.ts`
- `apps/api/src/lib/mime-sniff.test.ts`
- `Suggestion.md` (this file)

### Updated (selected)
- `apps/api/prisma/schema.prisma`
- `apps/api/src/lib/env.ts`, `upload-access.ts`, `storage.ts`, `admin-permissions.ts`
- `apps/api/src/requests/*`, `conversations/*`, `auth/*`, `users/*`, `devices/*`
- `apps/api/src/admin/*`, `support/*`, `jobs/*`, `middleware/rate-limit.ts`
- `apps/api/src/common/*`, `health/*`, `uploads/*`, `categories/*`, `prisma/prisma.service.ts`, `app.module.ts`
- `apps/api/.env.example`, `apps/api/package.json`, `pnpm-lock.yaml`
- `docker-compose.yml`, `.env.docker.example`

### Deleted
- `apps/api/src/lib/create-prisma.ts`

---

## Breaking changes

1. **Public request list** no longer includes `PENDING_REVIEW`. Clients that filtered pending on the public list must use owner `mine` / admin APIs.
2. **`isPremium` removed** from user create/update request body (`forbidNonWhitelisted` will 400 if sent).
3. **Request detail visibility:** non-open requests return 404 to non-participants.
4. **Production env:** requires `API_PUBLIC_URL` (non-localhost), non-localhost `PASSWORD_RESET_URL`, `UPLOAD_SIGNING_SECRET`, and forbids insecure DB SSL.
5. **Support ticket payloads:** `email` omitted for non-admin viewers (including assigned admin email).
6. **Message endpoints** return at most the latest N messages (100 default) instead of full history.
7. **Admin `deleteReview` response** simplified to `{ deleted, id }` (rating refresh still applied).
8. **Passwords capped at 72 characters** (bcrypt limit) on register/reset/login/delete.
9. **Global JWT auth:** routes without `@Public()` require a Bearer token by default.

Run `pnpm db:push` (or equivalent) after deploy to apply new indexes.

---

## Verification

```bash
cd apps/api
pnpm typecheck   # pass
pnpm lint        # pass
pnpm test        # 12 files / 40 tests pass
```
