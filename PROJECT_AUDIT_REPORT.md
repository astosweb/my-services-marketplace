# Bidy — Project Audit Report

**Date:** 2026-08-05  
**Scope:** Full monorepo (`apps/api`, `apps/admin`, `apps/web`, `packages/shared`, `ios-app`, Docker/CI)  
**Baseline documents:** Root [`README.md`](./README.md), [`apps/api/README.md`](./apps/api/README.md), [`apps/admin/README.md`](./apps/admin/README.md), [`ios-app/README.md`](./ios-app/README.md), [`apps/admin/AGENTS.md`](./apps/admin/AGENTS.md)  
**Method:** Static source review of the entire codebase against documented requirements. Runtime behavior (live APNs, Resend delivery, Spaces I/O, production traffic) was **not** executed end-to-end in this audit unless noted. Claims that could not be verified are marked explicitly.

---

## Executive Summary

Bidy is a coherent NestJS-centered marketplace monorepo with a strong API domain model (requests → offers → job progress → reviews), a capable admin/support surface, a public Next.js web app, and a feature-rich SwiftUI client. Architecture matches the root README’s intended BFF + Nest + Postgres/Redis/Spaces shape.

The largest gaps vs the product concept in the root README are: **incomplete job lifecycle on web**, **stale/incorrect admin documentation**, **binary API RBAC vs advertised fine-grained RBAC**, **no payments (acknowledged)**, **thin automated test coverage outside the API**, **CI only for the API**, and **missing production observability/backup**. The API itself is the most production-oriented component; web and documentation lag.

| Score | Value |
|-------|-------|
| **Overall Score** | **62 / 100** |
| **Production Readiness Score** | **54 / 100** |

---

## Overall Score (62%)

| Area | Score | Weight | Notes |
|------|------:|-------:|-------|
| Project completeness vs README concept | 58 | High | Full loop exists in API/iOS; web incomplete |
| Architecture & maintainability | 72 | High | Clear monorepo boundaries; shared package drift |
| Security | 64 | Critical | Solid Nest foundations; BFF CSRF & doc/RBAC gaps |
| Database | 68 | High | Good indexes/relations; stale migrations; weak uniques |
| API quality | 78 | High | Broad surface, envelopes, validation, Swagger |
| Frontend (web) | 52 | Medium | Browse/create/offer OK; lifecycle/support missing |
| Admin panel | 66 | Medium | Ops features real; settings/templates/docs stale |
| Mobile (iOS) | 74 | Medium | Closest to full product; no offline/tests |
| DevOps | 55 | High | Docker solid; CI/monitoring/backup incomplete |
| Testing | 40 | High | API unit tests only; no E2E; web/iOS untested |
| Documentation | 55 | Medium | Strong root README; admin README highly inaccurate |

---

## Production Readiness Score (54%)

**Justification:** Suitable for a controlled staging / private beta of the API + admin + iOS core flows. Not ready for an unattended public launch without addressing Critical items: migration strategy for real databases, CSRF hardening on cookie BFFs, documentation that matches ops reality, web job-lifecycle parity (if web is a launch channel), CI for admin/web, and monitoring/backup/secrets ops.

Payments are intentionally out of scope per web FAQ copy; that lowers “marketplace completeness” but is not treated as a silent defect.

---

## Architecture Review

### Verified strengths

- Monorepo layout matches root README (`apps/api`, `apps/admin`, `apps/web`, `packages/shared`, `ios-app`).
- Single Prisma schema at `apps/api/prisma/schema.prisma`; admin `lib/prisma.ts` is an intentional throw-stub directing traffic to Nest.
- Clients use BFF cookie proxies (web/admin) or Bearer JWT (iOS) as documented.
- Nest modules map 1:1 to documented controllers (Health, Auth, Categories, Requests, Conversations, Notifications, Users, Devices, Uploads, Support, Admin Support, Admin).
- Shared package centralizes Zod/types for web/admin.

### Concerns

| Issue | Detail |
|-------|--------|
| Dual validation systems | Nest uses `class-validator` DTOs; clients use Zod in `@monorepo/shared`. Drift verified (profile bio/businessName, request location/budgetLabel limits). |
| Admin README vs reality | Describes local Prisma, Tasks API, Session model, 5-role RBAC — none match current code. |
| Missing root `AGENTS.md` | Referenced by `apps/admin/AGENTS.md`; file does not exist. |
| Template residue in admin | Duplicate sign-in/forgot-password pages, mock settings/billing JSON. |
| Scalability | Stateless API + Redis rate limits/BullMQ is sound for horizontal scale; conversations lack strong pagination; typing indicators are in-memory only. |
| Maintainability | Naming mix (`@hero/api`, `admin-panel`, `web`, “Bidy” / “hero”) increases cognitive load. |

### Separation of concerns

**Good:** Domain logic concentrated in Nest services; frontends are mostly UI + API clients.  
**Weak:** Admin UI permission strings imply fine-grained server RBAC that the API does not enforce (only `UserRole.ADMIN` via `AdminGuard`).

---

## Feature Gap Analysis

### Domain flow (root README)

| Step | API | Admin | Web | iOS |
|------|:---:|:-----:|:---:|:---:|
| Create request (`PENDING_REVIEW`) | ✅ | ✅ create/approve/reject | ✅ | ✅ |
| Browse open (list) | ✅ | ✅ | ✅ | ✅ |
| Browse map | — | — | ❌ | ✅ |
| Submit offer | ✅ | ✅ moderate | ✅ | ✅ |
| Accept / decline / withdraw offer | ✅ | ✅ | ❌ | ✅ |
| Messaging | ✅ | ✅ view | ✅ (poll, no WS) | ✅ |
| Job progress | ✅ | — | ❌ | ✅ |
| Complete + review | ✅ | ✅ reviews CRUD | ❌ submit | ✅ |
| Support help desk | ✅ | ✅ | ❌ | ✅ |
| Push notifications | ✅ APNs | — | ❌ devices | ✅ |
| Payments / escrow | ❌ | ❌ | ❌ (FAQ admits) | ❌ |
| Premium listing | Boolean flag only | Flag | Checkbox | Unverified payment link |

### Missing / partial by surface

**API (vs root + api README):** Documented public marketplace/auth/upload endpoints verified present. Large undocumented admin/support surface exists (acceptable if intentional; docs partially cover it in root README). No payment module. Premium is a boolean, not monetized.

**Web:** Missing owner offer management, status/progress, review submission, support, map explore, device/push registration, server-side favorites (localStorage only), realtime messaging. Keyword search is client-side over fetched pages, not a server search API.

**Admin:** Core marketplace + support ops verified API-backed. Settings user/appearance/notifications/connections/billing are mock or `console.log`. Feature flags page redirects (not implemented). Roles page is read-only catalog of `ADMIN`/`USER`.

**iOS:** Closest to full product. README claims Explore “Search”; no search text field found in `ExploreView.swift` (city/category/sort only) — **partial README miss**. No offline cache. No XCTest targets found.

**Shared:** Contracts exist but are not the source of truth for Nest validation.

---

## Security Review

### Verified positives

- bcrypt password hashing; refresh tokens hashed (SHA-256), rotated, revocable.
- JWT strategy rejects banned/missing users.
- Production boot asserts: no example `JWT_SECRET`, no `CORS_ORIGIN=*`, Spaces required, Resend required, local upload storage forbidden, Redis required unless explicitly opted out.
- Helmet, 2 MB JSON body limit, Swagger off in production by default.
- Upload images re-encoded via `sharp`; size/MIME allowlists in storage layer.
- Private uploads (`messages/*`, `support/*`) use signed HMAC URLs + auth fallback.
- Credential/refresh/view/support custom rate limits (Redis-backed when configured) plus global Nest Throttler (~100/min).
- Structured logging with credential redaction (Pino) per API README/ops notes.
- Admin BFF does not forward client `Authorization`; builds Bearer from HttpOnly cookies.

### Gaps and risks

| Topic | Finding |
|-------|---------|
| Authorization / RBAC | API admin is binary `ADMIN`. Fine-grained permissions gate UI only — not re-checked per admin endpoint action. |
| CSRF | Cookie-authenticated same-origin BFFs (web/admin) have no verified CSRF token/Origin enforcement on mutating proxies. |
| Logout | Refresh revoked; access JWT not blacklisted until expiry. |
| File upload | Non-image document MIME relies on client-reported `mimetype` (no signature sniffing verified). |
| BFF proxy breadth | Catch-all `/api/[...path]` can forward arbitrary Nest paths; not limited to an allowlist. |
| Public profiles | Banned users not filtered on public `GET /users/:id` (verified in users service behavior description). |
| Secrets | Env examples exist for API/docker; **no** `apps/admin/.env.example` or `apps/web/.env.example`. |
| Audit logs | Used for admin/support actions; actor deletion cascades and removes audit rows. |
| Monitoring | No Sentry/Datadog/OTel/app metrics integration found in app code. |
| Admin template auth pages | `sign-in-2` / `sign-in-3` post to `/dashboard` without real auth — risk if exposed/linked. |

---

## Performance Review

| Area | Finding |
|------|---------|
| API | Pagination via `limit`/`offset` common; indexes on hot paths (city/status, notifications, support queues). Conversations list lacks full pagination meta. |
| DB | Missing `RefreshToken.expiresAt` index despite cleanup job filtering on it. Offer/review uniqueness is application-level only (race risk). |
| Caching | Redis used for rate limits/jobs; no response/entity cache layer verified. |
| Frontend | React Query used; skeletons/empty states present on web. No bundle analysis or image CDN strategy documented for web beyond Spaces/CDN flags. |
| Messaging | No WebSocket/SSE; clients poll — fine for MVP, not ideal at scale. |
| Typing indicators | In-memory only — will not work across API instances. |
| Lazy loading | Next App Router used; no verified route-level performance budget or RSC data caching strategy documented. |
| Memory | Not measured in this audit (**unverifiable** without load tests). |

---

## Code Quality Review

| Topic | Finding |
|-------|---------|
| Type safety | TypeScript strict across TS apps; Nest + Zod usage solid. Shared/API limit drift. |
| Linting | ESLint configs present for api/admin/web; Prettier on API. |
| Naming | Product “Bidy” vs packages `@hero/api` / DB user `hero` / seed emails `admin@hero.test`. |
| Duplication | Admin auth UI ×3; settings templates; dual DTO systems. |
| Dead / stale code | Admin prisma stub, local audit helpers, Tasks/ActivityLog README claims, billing JSON, feature-flag redirect, shadcn placeholder pages. |
| Technical debt | Stale Prisma migrations vs `db push`; admin README rewrite owed; permission model mismatch. |
| Tests | API: 11 files / 35 tests (verified by prior test run context in exploration). Admin: 5 unit tests. Web: 0. iOS: 0. Shared: 0. No E2E. |

---

## Missing Features

1. Payments / escrow / payouts (explicitly deferred in web FAQ).
2. Web: accept/decline offers, job progress, reviews, support, map, push.
3. Realtime messaging (WebSocket/SSE).
4. Server-side favorites / saved searches.
5. Email verification (claimed in admin README; **not** in schema).
6. Multi-role RBAC (Super Admin / Manager / Editor) — README claim; schema only `USER` \| `ADMIN`.
7. Feature flags system (admin page stubs to system status).
8. Admin/web CI pipelines; E2E suite.
9. Observability stack (APM, error tracking, uptime).
10. Documented DB backup/restore strategy.
11. Root `AGENTS.md` (referenced, missing).
12. Accurate admin setup docs / `.env.example` for web & admin.

---

## Recommended Improvements

Grouped by severity. Each item includes the fields requested for issue tracking.

---

## 🔴 Critical

### C1. Rewrite admin README (and demo credentials) to match Nest BFF architecture

- **Severity:** Critical  
- **Description:** `apps/admin/README.md` still documents local Prisma, Session/Task/ActivityLog models, signup, email verification, Tasks API, and five RBAC roles. Actual admin authenticates via Nest JWT cookies and proxies `/admin/*`. Seed script only points to API seed.  
- **Why it matters:** Misleads operators and agents; wrong env/setup causes failed deploys and security assumptions.  
- **Recommended solution:** Replace README with Nest-proxy setup (`API_URL`, cookie auth, demo admin from API seed). Remove Tasks/ActivityLog/signup claims.  
- **Estimated complexity:** Low  
- **Dependencies:** Confirm current seed admin email/password in `apps/api/prisma/seed.ts`.  
- **Files affected:** `apps/admin/README.md`, possibly `apps/admin/AGENTS.md`, root README link text.

### C2. Harden BFF mutating requests against CSRF

- **Severity:** Critical  
- **Description:** Web and admin store JWTs in cookies and proxy mutations through `/api/[...path]` without verified CSRF/Origin checks.  
- **Why it matters:** Classic cross-site request forgery against cookie sessions.  
- **Recommended solution:** Require `Origin`/`Referer` allowlist and/or double-submit CSRF token on state-changing methods; tighten cookie `SameSite` policy for production.  
- **Estimated complexity:** Medium  
- **Dependencies:** Cookie/CORS configuration.  
- **Files affected:** `apps/web/app/api/[...path]/route.ts`, `apps/admin/app/api/[...path]/route.ts`, auth cookie helpers.

### C3. Define production schema migration strategy

- **Severity:** Critical  
- **Description:** README prefers `db push`. Migration folder only has init + notification preferences; schema has support, audit, roles/status, etc. not reflected in SQL migrations.  
- **Why it matters:** `db push` is unsafe for shared production DBs needing reviewable, reversible DDL.  
- **Recommended solution:** Either regenerate authoritative migrations from current schema for deploy, or document explicit push-only environments and backup requirements.  
- **Estimated complexity:** High  
- **Dependencies:** Production DB state audit.  
- **Files affected:** `apps/api/prisma/migrations/**`, `apps/api/prisma/schema.prisma`, deploy docs.

### C4. Close web marketplace lifecycle gap (if web is a launch surface)

- **Severity:** Critical (for web launch) / High (if iOS-only launch)  
- **Description:** Root concept requires accept offer → progress → complete → review. Web only creates requests and submits offers.  
- **Why it matters:** Web users cannot finish the documented product loop.  
- **Recommended solution:** Port iOS request-detail owner/provider actions to web (offers respond, status, progress, reviews).  
- **Estimated complexity:** High  
- **Dependencies:** Existing Nest endpoints already present.  
- **Files affected:** `apps/web/app/(marketplace)/requests/[id]/page.tsx`, hooks, shared schemas.

### C5. Remove or gate non-functional admin auth templates

- **Severity:** Critical  
- **Description:** `sign-in-2` / `sign-in-3` (and similar forgot-password variants) bypass real login and navigate to dashboard.  
- **Why it matters:** Accidental exposure undermines auth.  
- **Recommended solution:** Delete unused templates or restrict to non-production builds.  
- **Estimated complexity:** Low  
- **Dependencies:** None  
- **Files affected:** `apps/admin/app/(auth)/sign-in-2/**`, `sign-in-3/**`, related forgot-password-2/3, `proxy.ts` public path list.

---

## 🟠 High Priority

### H1. Enforce or simplify RBAC model

- **Severity:** High  
- **Description:** Docs/UI advertise fine-grained permissions; API `AdminGuard` only checks `role === ADMIN`. All admins get full `ADMIN_PERMISSIONS` list.  
- **Why it matters:** False sense of least privilege; cannot safely hire limited support staff.  
- **Recommended solution:** Either implement server-side permission checks per route, or document binary admin and remove multi-permission UX pretenses.  
- **Estimated complexity:** High (real RBAC) / Low (docs+UI simplify)  
- **Dependencies:** Product decision on roles.  
- **Files affected:** `apps/api/src/common/guards/admin.guard.ts`, `apps/api/src/lib/admin-permissions.ts`, `packages/shared/src/permissions.ts`, admin nav.

### H2. Expand CI beyond API

- **Severity:** High  
- **Description:** `.github/workflows/api-ci.yml` only lints/tests/builds `apps/api` (+ shared path filters). Admin/web have no CI.  
- **Why it matters:** Regressions ship unnoticed on primary UIs.  
- **Recommended solution:** Add workflows for admin/web typecheck/lint/test/build; optionally Playwright smoke.  
- **Estimated complexity:** Medium  
- **Dependencies:** Test scripts for web.  
- **Files affected:** `.github/workflows/**`, `apps/web/package.json`.

### H3. Add observability and health depth

- **Severity:** High  
- **Description:** `/health/ready` checks DB only. No APM/error tracking. Redis/Spaces/APNs not in readiness.  
- **Why it matters:** Blind production incidents.  
- **Recommended solution:** Extend readiness; integrate Sentry (or similar); ship structured log shipping.  
- **Estimated complexity:** Medium  
- **Dependencies:** Vendor choice / secrets.  
- **Files affected:** `apps/api/src/health/**`, `main.ts`, compose/deploy config.

### H4. Database integrity constraints for offers/reviews

- **Severity:** High  
- **Description:** Duplicate offers/reviews prevented in service code, not unique constraints.  
- **Why it matters:** Concurrent requests can create duplicates.  
- **Recommended solution:** Add `@@unique([requestId, offererId])` (or product rule) and review uniqueness; handle P2002.  
- **Estimated complexity:** Medium  
- **Dependencies:** Data cleanup of existing duplicates.  
- **Files affected:** `schema.prisma`, `requests.service.ts`.

### H5. Align `@monorepo/shared` Zod with Nest DTOs

- **Severity:** High  
- **Description:** Verified limit mismatches (bio 2000 vs 1000, businessName 120 vs 100, budgetLabel 100 vs 50, location required vs optional).  
- **Why it matters:** Client-side validation passes then API 400s (or vice versa).  
- **Recommended solution:** Single source of truth — generate or share schemas; add contract tests.  
- **Estimated complexity:** Medium  
- **Dependencies:** None  
- **Files affected:** `packages/shared/src/**`, `apps/api/src/**/*.dto.ts`.

### H6. Production backup & restore runbook

- **Severity:** High  
- **Description:** Compose volumes exist; no documented backup/PITR/restore for Postgres or Spaces.  
- **Why it matters:** Data loss risk.  
- **Recommended solution:** Document managed Postgres backups + Spaces versioning; add restore drill.  
- **Estimated complexity:** Medium  
- **Dependencies:** Hosting provider.  
- **Files affected:** Ops docs (new), possibly compose.

### H7. Web support + favorites persistence (product parity)

- **Severity:** High  
- **Description:** Support API/iOS/admin exist; web has no help desk. Favorites are localStorage-only.  
- **Why it matters:** Incomplete user support path on web; favorites don’t sync.  
- **Recommended solution:** Add support UI; either drop favorites or add server model.  
- **Estimated complexity:** Medium–High  
- **Dependencies:** Support APIs already exist.  
- **Files affected:** `apps/web/app/**`, possibly schema if favorites become server-side.

---

## 🟡 Medium Priority

### M1. Pagination consistency (conversations & others)

- **Severity:** Medium  
- **Description:** Conversations return unread meta without full total/limit/offset pattern used elsewhere.  
- **Why it matters:** Clients cannot reliably page large inboxes.  
- **Recommended solution:** Standardize list `meta` across modules.  
- **Estimated complexity:** Medium  
- **Files affected:** `conversations.controller.ts`, DTOs, web/iOS clients.

### M2. Index `RefreshToken.expiresAt`

- **Severity:** Medium  
- **Description:** Cleanup job deletes by `expiresAt` without an index.  
- **Why it matters:** Table scans as tokens grow.  
- **Estimated complexity:** Low  
- **Files affected:** `schema.prisma`.

### M3. Preserve audit logs on user delete

- **Severity:** Medium  
- **Description:** `AuditLog.actor` uses `onDelete: Cascade`.  
- **Why it matters:** Compliance/audit trail disappears with actor.  
- **Recommended solution:** `SetNull` + nullable actor, or soft-delete users.  
- **Estimated complexity:** Medium  
- **Files affected:** `schema.prisma`, admin delete flows.

### M4. Remove mock admin settings or wire them

- **Severity:** Medium  
- **Description:** Billing JSON, appearance/notifications `console.log`, connections, feature-flags redirect.  
- **Why it matters:** Looks production-ready but isn’t.  
- **Estimated complexity:** Low–Medium  
- **Files affected:** `apps/admin/app/(dashboard)/settings/**`.

### M5. Document API versioning policy

- **Severity:** Medium  
- **Description:** No `/v1` prefix or versioning strategy.  
- **Why it matters:** Breaking changes will hurt mobile clients.  
- **Estimated complexity:** Low (policy) / High (implement versions)  
- **Files affected:** Docs; optionally Nest global prefix.

### M6. iOS Explore search parity with README

- **Severity:** Medium  
- **Description:** README claims search; Explore implements filters/sort only.  
- **Why it matters:** Doc/product mismatch.  
- **Estimated complexity:** Medium  
- **Files affected:** `ExploreView.swift`, README.

### M7. Add web/admin `.env.example`

- **Severity:** Medium  
- **Description:** Only API and docker examples exist.  
- **Estimated complexity:** Low  
- **Files affected:** `apps/web/.env.example`, `apps/admin/.env.example`.

### M8. Support attachment `sizeBytes: 0` metadata bug

- **Severity:** Medium  
- **Description:** Exploration found support attachment association storing `sizeBytes: 0` despite upload returning size.  
- **Why it matters:** Incorrect metadata for moderation/quotas.  
- **Estimated complexity:** Low  
- **Files affected:** `apps/api/src/support/support.service.ts`.

### M9. Create missing root `AGENTS.md`

- **Severity:** Medium  
- **Description:** Admin AGENTS references `../../AGENTS.md` which is absent.  
- **Estimated complexity:** Low  
- **Files affected:** `/AGENTS.md`, `apps/admin/AGENTS.md`.

---

## 🟢 Nice to Have

### N1. Realtime messaging (WebSocket/SSE)

- **Severity:** Nice to have  
- **Description:** Polling-only chat.  
- **Estimated complexity:** High  
- **Files affected:** API gateway, web, iOS.

### N2. Offline mode for iOS

- **Severity:** Nice to have  
- **Description:** Ephemeral URLSession; no durable cache.  
- **Estimated complexity:** High  
- **Files affected:** iOS Core layer.

### N3. E2E suite (Playwright + XCUITest)

- **Severity:** Nice to have (High value long-term)  
- **Estimated complexity:** High  
- **Files affected:** New test projects.

### N4. Unify branding/package naming (`hero` → `bidy`)

- **Severity:** Nice to have  
- **Estimated complexity:** High (breaking)  
- **Files affected:** packages, compose, seeds, bundle IDs.

### N5. Map browse on web

- **Severity:** Nice to have  
- **Description:** iOS has MapKit explore; web does not.  
- **Estimated complexity:** Medium  
- **Files affected:** `apps/web` explore pages.

### N6. Access-token denylist on logout

- **Severity:** Nice to have  
- **Estimated complexity:** Medium  
- **Files affected:** Auth service, Redis.

### N7. MIME sniffing for non-image uploads

- **Severity:** Nice to have  
- **Estimated complexity:** Medium  
- **Files affected:** `storage.ts`, uploads.

---

## Technical Debt

1. **Documentation drift** — Admin README is a prior product generation.  
2. **Scaffolding debt** — shadcn template auth/settings/billing pages.  
3. **Contract dualism** — Zod shared vs class-validator Nest DTOs.  
4. **Migration archaeology** — Incomplete SQL history under `prisma/migrations`.  
5. **Permission theater** — Rich permission strings without server enforcement.  
6. **Inconsistent product naming** — Bidy / hero / monorepo mix.  
7. **Test pyramid inversion** — Some API unit tests; almost no UI/E2E.  
8. **Premium boolean** without monetization path (enum noise: `PAYMENT_RECEIVED`, `PREMIUM_BOOST`).

---

## Risks Before Launch

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Wrong admin ops docs → misconfigured deploy | High | High | C1 |
| CSRF on cookie BFF | High | Medium | C2 |
| Schema push on live DB | High | Medium | C3 |
| Web users stuck mid-job | High | High (if web launched) | C4 |
| Fake auth template pages | High | Low–Medium | C5 |
| No monitoring → slow incident response | High | High | H3 |
| Duplicate offers under concurrency | Medium | Medium | H4 |
| Client/API validation drift | Medium | High | H5 |
| Data loss without backups | Critical | Low–Medium | H6 |
| Overstated RBAC for support hiring | Medium | High | H1 |
| APNs/Resend/Spaces misconfig | High | Medium | Staging soak + H3 |
| Payments expectation mismatch | Medium | Medium | Keep FAQ clear; no “pay” UI |

**Unverified before launch (must validate in staging):** end-to-end Resend email delivery, APNs production delivery, Spaces CDN public policy, Docker production `NODE_ENV`/cookie secure flags, load behavior under multi-instance typing/rate limits.

---

## Prioritized Roadmap

### Phase 0 — Launch blockers (Critical)

1. Fix/rewrite admin documentation & remove fake auth templates (C1, C5).  
2. CSRF harden BFFs (C2).  
3. Decide and implement DB migration approach for production (C3).  
4. If web is in scope: implement offer/progress/review flows (C4).  
5. Staging checklist: Spaces, Resend, APNs, `COOKIE_SECURE`, CORS allowlist.

### Phase 1 — Hardening (High)

1. RBAC decision + enforcement (H1).  
2. CI for admin/web (H2).  
3. Observability + richer readiness (H3).  
4. Unique constraints + shared contract sync (H4, H5).  
5. Backup/restore runbook (H6).  
6. Web support desk (H7).

### Phase 2 — Product polish (Medium)

1. Pagination, token index, audit retention (M1–M3).  
2. Clean or implement settings (M4).  
3. API versioning policy (M5).  
4. iOS search + env examples + AGENTS.md (M6, M7, M9).  
5. Support attachment size fix (M8).

### Phase 3 — Differentiation (Nice)

1. Realtime chat, offline iOS, E2E, map-on-web, brand rename, payment provider evaluation (N1–N7 + future payments epic).

---

## Appendix A — Component scores (detail)

### 1. Project Completeness

- **API:** High completeness vs README endpoint lists; admin/support exceed older api README.  
- **Admin:** Ops complete for marketplace/support; settings/RBAC/docs incomplete.  
- **Web:** Partial marketplace.  
- **iOS:** Near-complete client.  
- **TODO/FIXME:** No meaningful `TODO`/`FIXME` markers found under `apps/api`. Feature stubs appear as redirects/`console.log`/README lies rather than TODOs.

### 2. Architecture — see Architecture Review.

### 3. Feature gaps — see Feature Gap Analysis.

### 4. Security — see Security Review.

### 5. Database

- Quality: strong relational model for marketplace + support.  
- Indexes: good coverage; gap on `RefreshToken.expiresAt`.  
- Constraints: missing offer/review uniques.  
- Migrations: stale vs schema; project standard is `db push`.  
- Performance: adequate for MVP scale; not load-tested here.

### 6. API

- REST-ish resource routes; consistent error envelope (health endpoints raw).  
- Validation via pipes/DTOs; Swagger present.  
- Pagination/filter/sort on admin/marketplace; weaker on conversations.  
- No URL versioning.  
- Docs: root README + Swagger + api README (admin routes better covered in root).

### 7. Frontend (web)

- Landing composed and partially live.  
- Loading/error/empty components exist.  
- Responsive class usage present.  
- A11y: labels and some `aria-label`s; not formally audited.  
- Missing lifecycle UX is the main gap.

### 8. Mobile

- Navigation shell solid; push registration implemented; Keychain for refresh when Remember Me.  
- No offline; no automated tests found.  
- Search claim unmet.

### 9. Admin Panel

- Dashboard, users, requests moderation, offers, reviews, categories, conversations, support, roles (read-only), system status: **real**.  
- Billing/appearance/notifications/connections/feature-flags: **mock/stub**.  
- Audit: backend logs; dedicated admin “audit trail” page as old README described: **not found** as local API.

### 10. Performance — see Performance Review.

### 11. DevOps

- Docker multi-target Dockerfile + compose with healthchecks: **good**.  
- CI: API only.  
- Env validation: strong on API boot.  
- Monitoring/backup: **missing**.  
- Deployment readiness: good scaffolding, incomplete ops maturity.

### 12. Code Quality — see Code Quality Review.

### 13. Testing

| Suite | Present | Notes |
|-------|---------|-------|
| API unit | Yes (11 files) | Auth helpers, rate limit, requests list, support basics, push prefs, etc. |
| API e2e | No | No `*.e2e-spec.ts` |
| Admin unit | Yes (5) | Permissions, password, rate-limit, client, support upload |
| Web | No | No test script |
| iOS | No | No test target found |
| Shared | No | typecheck only |
| Coverage gates | Not verified | No coverage thresholds found in CI |

### 14. Documentation

| Doc | Status |
|-----|--------|
| Root README | Strong, current architecture/API map |
| API README | Accurate for core public API + prod env |
| Admin README | **Severely outdated** |
| iOS README | Mostly accurate; search overstated |
| Admin AGENTS | Partially stale; references missing root AGENTS |
| Web README | Missing |
| Deployment guide | Partial (compose + env); no runbook |
| API OpenAPI | Available via Swagger when enabled |

### 15. Production readiness — **54%** (see above).

---

## Appendix B — Inventory (verified counts)

| Item | Count / note |
|------|----------------|
| Nest controllers | 12 |
| Nest services | 14 |
| API `*.test.ts` | 11 |
| Admin `*.test.ts` | 5 |
| Web tests | 0 |
| Admin `page.tsx` | 32 |
| Web `page.tsx` | 21 |
| iOS Swift sources | 16 |
| Approx. LOC (TS API src) | ~9.5k |
| Approx. LOC (admin TS/TSX) | ~60k (incl. UI kit) |
| Approx. LOC (web TS/TSX) | ~20k |
| Approx. LOC (iOS Swift) | ~9k |

---

## Appendix C — README claim verification matrix

| Claim (root README unless noted) | Verdict |
|----------------------------------|---------|
| Requester posts request with category/city/budget/photos | ✅ API + web + iOS |
| Providers browse list or map | ⚠️ List all clients; map iOS only |
| Owner accepts offer → message → progress → review | ✅ API/iOS; ❌ web incomplete |
| Admins moderate requests/users/offers/reviews/categories/support | ✅ |
| Cities: Tallinn, Tartu, Pärnu, Narva | ✅ `EstonianCity` enum |
| Web/Admin BFF cookie proxy | ✅ |
| iOS Bearer + coalesced refresh | ✅ |
| Frontends must not use Prisma for marketplace | ✅ admin stub enforces |
| `{ data }` success envelope | ⚠️ Most routes; health raw |
| Rate limit ~100/min | ✅ Throttler configured |
| Fine-grained admin permissions gate API usage | ❌ UI only; API is role check |
| Payments | ❌ Deferred (web FAQ) |
| Admin README: local Prisma/Tasks/5 roles/signup | ❌ False vs code |
| iOS README: Explore search | ❌ Not found in Explore UI |
| `AGENTS.md` at repo root | ❌ Missing |

---

*End of report. This document reflects static verification as of the audit date; re-validate runtime integrations in a staging environment before production cutover.*
