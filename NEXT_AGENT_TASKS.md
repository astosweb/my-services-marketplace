# NEXT_AGENT_TASKS — Davay Production Implementation Backlog

> **Audience:** Next AI agent executing sequentially.  
> **Scope:** `davay-api` (Hono/Prisma) + `davayApp` (SwiftUI iOS).  
> **Not in repo:** Web frontend, admin panel, shared packages, CI/CD, API Dockerfile.  
> **Rule:** Do not expand scope beyond the task. Complete Critical before High unless a dependency says otherwise.  
> **Package manager:** `pnpm`. Schema sync: prefer versioned migrations after `C-INF-01`; until then `prisma generate` + `prisma db push` per project convention.

**Recommended execution order (Critical → High):**  
`C-API-01` → `C-API-02` → `C-API-03` → `C-API-05` → `C-INF-01` → `C-IOS-01` → `C-IOS-02` → `C-IOS-03` → `C-API-04` → `C-API-06` → `C-IOS-04` → `C-IOS-05` → `C-INF-02` → then High Priority in listed order.

---

## Critical

Issues preventing production deployment.

---

### C-API-01 — Remove unauthenticated passwordless user creation

| Field | Value |
| --- | --- |
| **Priority** | Critical |
| **Module(s)** | Backend/API, Auth |
| **Complexity** | Small |

**Problem**  
`POST /users` creates users with email + displayName and **no password**, with **no auth**. Attackers can squat emails (blocking `/auth/register`), pollute profiles, and create fake marketplace identities. README even documents this endpoint.

**Approach**  
1. Delete `userRoutes.post("/")` and `createUserSchema` from `users.ts`.  
2. Ensure `/auth/register` is the only signup path.  
3. Update README endpoint table; remove or mark obsolete any client callers (none expected in iOS).  
4. Add a negative test: `POST /users` → 404.

**Expected files**  
- `davay-api/src/routes/users.ts`  
- `davay-api/README.md`  
- `davay-api/src/routes/users.test.ts` (new) or extend health/route tests  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] `POST /users` returns 404 (or is removed from router).  
- [ ] Users can only be created via `/auth/register` with a password hash.  
- [ ] README no longer lists passwordless create.  
- [ ] Test covers rejection.

---

### C-API-02 — Add rate limiting on auth and abuse-prone endpoints

| Field | Value |
| --- | --- |
| **Priority** | Critical |
| **Module(s)** | Backend/API, Security, Infrastructure |
| **Complexity** | Medium |

**Problem**  
No rate limiting anywhere. Login, register, forgot-password, refresh, and unauthenticated view increments are trivially brute-forceable / abusable. Redis is in Docker Compose but unused by app code.

**Approach**  
1. Add Redis-backed (or in-memory fallback for single-node) rate limiter middleware.  
2. Limits (starting point): login/register/forgot `5/min` per IP+email; refresh `30/min` per IP; views `10/min` per IP+requestId.  
3. Return `429` with `{ error: { message, code: "RATE_LIMITED" } }`.  
4. Wire `REDIS_URL` or document in-memory-only mode and fail closed in production if Redis missing when rate limit required.  
5. Unit-test limiter behaviour with mocked store.

**Expected files**  
- `davay-api/src/middleware/rate-limit.ts` (new)  
- `davay-api/src/app.ts`  
- `davay-api/src/routes/auth.ts`  
- `davay-api/src/routes/requests.ts` (views)  
- `davay-api/src/lib/env.ts`  
- `davay-api/package.json` (redis client if chosen)  
- `davay-api/.env.example`, `README.md`  

**Dependencies**  
None (can land before email). Prefer before public deploy.

**Acceptance criteria**  
- [ ] Exceeding limits returns 429 with stable error code.  
- [ ] Auth endpoints limited per IP and identifier.  
- [ ] Redis either used or explicitly optional with documented fallback.  
- [ ] Tests prove throttle + reset window.

---

### C-API-03 — Ship transactional email for password reset

| Field | Value |
| --- | --- |
| **Priority** | Critical |
| **Module(s)** | Backend/API, Auth, Third-party integrations |
| **Complexity** | Medium |

**Problem**  
`POST /auth/forgot-password` creates a hashed reset token but **never sends email**. Production returns a generic message with no delivery path → users cannot recover accounts. Dev leaks `token`/`resetLink` (acceptable for local only).

**Approach**  
1. Add mailer abstraction (`src/lib/mailer.ts`) with provider (Resend / SES / SMTP).  
2. Env: `EMAIL_FROM`, provider API key, keep `PASSWORD_RESET_URL`.  
3. On forgot-password: always same HTTP response; send email asynchronously or best-effort without leaking existence beyond timing (document tradeoff).  
4. Production: never include raw token in JSON.  
5. Log delivery failures; do not fail open by returning token in prod.  
6. Integration test with mocked mailer.

**Expected files**  
- `davay-api/src/lib/mailer.ts` (new)  
- `davay-api/src/routes/auth.ts`  
- `davay-api/src/lib/env.ts`  
- `davay-api/.env.example`  
- `davay-api/README.md`  
- `davay-api/src/routes/auth.test.ts`  

**Dependencies**  
None. Complements `C-IOS-03` and `H-IOS-08` (deep links).

**Acceptance criteria**  
- [ ] Prod forgot-password triggers outbound email with reset link.  
- [ ] Prod JSON never contains `token` or `resetLink`.  
- [ ] Missing mailer config fails boot in `NODE_ENV=production` (or clearly disables reset with ops alert).  
- [ ] Tests assert mailer called with hashed-token flow intact.

---

### C-API-04 — Lock down messaging & private file access

| Field | Value |
| --- | --- |
| **Priority** | Critical |
| **Module(s)** | Backend/API, Security, Storage |
| **Complexity** | Large |

**Problem**  
1. Any authenticated user can `POST /requests/:id/messages` / open conversation with any request owner (spam/harassment).  
2. Spaces uploads use `ACL: "public-read"` including message attachments.  
3. Local `GET /uploads/*` is unauthenticated; non-images forced to `image/*` Content-Type.

**Approach**  
1. Messaging policy: allow thread only if (a) user is owner, (b) user has pending/accepted offer on request, or (c) owner opens chat with accepted provider. Document policy in README.  
2. Message attachment prefix: store private; serve via short-lived signed URLs or authenticated proxy.  
3. Request photos/avatars may remain public if product requires marketplace browse; do **not** use public-read for `messages/`.  
4. Local upload GET: require auth + ownership check for private keys; set correct MIME for PDF/etc.  
5. Add authorization tests for message deny/allow.

**Expected files**  
- `davay-api/src/routes/requests.ts`  
- `davay-api/src/routes/conversations.ts`  
- `davay-api/src/lib/storage.ts`  
- `davay-api/src/app.ts`  
- `davay-api/src/lib/serializers.ts`  
- `davay-api/README.md`  
- Tests under `davay-api/src/routes/`  

**Dependencies**  
None blocking. Coordinate iOS if signed URLs change attachment loading (`MessagesProfile.swift`).

**Acceptance criteria**  
- [ ] Unrelated users cannot open/message request owners.  
- [ ] Message attachment URLs are not world-readable without auth/signature.  
- [ ] Local private uploads not anonymously downloadable.  
- [ ] Negative auth tests pass.

---

### C-API-05 — Stop client-controlled premium; prepare payment gate

| Field | Value |
| --- | --- |
| **Priority** | Critical |
| **Module(s)** | Backend/API, Payments (future), iOS |
| **Complexity** | Medium |

**Problem**  
`POST /requests` accepts `isPremium` from the client and persists it. Premium boost / payment notification kinds exist but there is **no payment**. Free premium ranking abuse.

**Approach**  
1. Remove `isPremium` from create-request Zod schema; always `false` on create.  
2. Add internal/admin or webhook-only path to set premium after payment (stub webhook endpoint behind secret if provider not chosen yet).  
3. Update iOS so it never sends `isPremium` on create.  
4. Document payment provider choice as follow-up (`H-API-07`).

**Expected files**  
- `davay-api/src/routes/requests.ts`  
- `davayApp/davayApp/Features/NewRequestView.swift` (if it sends isPremium)  
- `davay-api/README.md`  

**Dependencies**  
None for stripping client flag. Full Stripe/etc. is `H-API-07`.

**Acceptance criteria**  
- [ ] Client cannot set `isPremium: true` via create API.  
- [ ] Existing premium display still works for server-set flag.  
- [ ] Tests assert ignored/rejected client premium field.

---

### C-API-06 — Account deletion API (GDPR / App Store)

| Field | Value |
| --- | --- |
| **Priority** | Critical |
| **Module(s)** | Backend/API, Auth, Mobile, Compliance |
| **Complexity** | Medium |

**Problem**  
No account deletion. App Store guideline 5.1.1(v) requires in-app account deletion for apps that support account creation. Schema cascades help, but no endpoint + no anonymization policy for reviews/messages.

**Approach**  
1. `DELETE /auth/me` (Bearer): verify password or re-auth confirmation body.  
2. Transaction: revoke refresh tokens, delete device tokens, delete user (Prisma cascades) **or** anonymize displayName/email and null password if retention required—pick one policy and document.  
3. Return 204; client signs out.  
4. Tests for cascade and auth requirement.

**Expected files**  
- `davay-api/src/routes/auth.ts`  
- `davay-api/prisma/schema.prisma` (only if soft-delete fields added)  
- `davay-api/README.md`  
- `davay-api/src/routes/auth.test.ts`  

**Dependencies**  
Required by `C-IOS-04`. Prefer after `C-API-01`.

**Acceptance criteria**  
- [ ] Authenticated user can delete own account.  
- [ ] Refresh tokens invalidated; login with old credentials fails.  
- [ ] Policy documented (hard delete vs anonymize).  
- [ ] Tests cover happy path + unauthorized.

---

### C-IOS-01 — Production HTTPS API base URL (stop Release LAN HTTP)

| Field | Value |
| --- | --- |
| **Priority** | Critical |
| **Module(s)** | Mobile (iOS), Security, Infrastructure |
| **Complexity** | Small |

**Problem**  
Debug **and** Release `DAVAY_API_BASE_URL` = `http://192.168.1.122:3000`. Tokens/PII over cleartext LAN; App Store builds point at a developer machine. `NSAllowsLocalNetworking` enabled for all builds.

**Approach**  
1. Debug: keep local HTTP (`127.0.0.1` or LAN).  
2. Release: `https://api.<production-host>` (placeholder env/xcconfig until host exists).  
3. Fail closed in `APIConfiguration` if Release URL is http/private IP.  
4. Gate ATS local-networking to Debug via build setting / separate plist if feasible.  
5. Update `davayApp/README.md`.

**Expected files**  
- `davayApp/davayApp.xcodeproj/project.pbxproj`  
- `davayApp/davayApp/Info.plist`  
- `davayApp/davayApp/Core/APIClient.swift`  
- `davayApp/README.md`  
- Optional: `Config/Debug.xcconfig`, `Config/Release.xcconfig`  

**Dependencies**  
Needs a real API hostname when deploying (`H-INF-01`). Can land with placeholder + assert HTTPS.

**Acceptance criteria**  
- [ ] Release configuration does not embed `192.168.*` / `http://`.  
- [ ] Debug can still hit local API.  
- [ ] Invalid/insecure Release URL fails with clear error, not silent wrong host.

---

### C-IOS-02 — Strip seed logins and hardcoded passwords from Release

| Field | Value |
| --- | --- |
| **Priority** | Critical |
| **Module(s)** | Mobile (iOS), Security |
| **Complexity** | Small |

**Problem**  
Login screen always shows “Quick seed login” buttons that fill `password123` for `@davay.test` accounts. Ships in production UI and binary strings.

**Approach**  
Wrap seed UI + `loginAsSeed` in `#if DEBUG`. Verify Release archive has no `password123` / `@davay.test` via `strings` check in docs/CI later.

**Expected files**  
- `davayApp/davayApp/Auth/AuthViews.swift`  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Release builds show no seed login UI.  
- [ ] Hardcoded seed password not compiled into Release (DEBUG-only).  

---

### C-IOS-03 — Stop production consumption of password-reset tokens from API JSON

| Field | Value |
| --- | --- |
| **Priority** | Critical |
| **Module(s)** | Mobile (iOS), Auth, Security |
| **Complexity** | Small |

**Problem**  
`AuthSession.developmentResetToken` stores API-returned reset tokens and Reset screen autofills them. If API ever returns tokens outside strict non-prod, this is account takeover UX.

**Approach**  
1. Only assign `developmentResetToken` under `#if DEBUG`.  
2. Release copy: “Check your email for a reset link.”  
3. Align with `C-API-03` email delivery.

**Expected files**  
- `davayApp/davayApp/Auth/AuthSession.swift`  
- `davayApp/davayApp/Auth/AuthViews.swift`  
- `davayApp/davayApp/Core/Models.swift` (optional model split)  

**Dependencies**  
Pairs with `C-API-03`; can land independently.

**Acceptance criteria**  
- [ ] Release never stores/displays API reset tokens.  
- [ ] DEBUG may still autofill for local QA.  

---

### C-IOS-04 — In-app account deletion UI

| Field | Value |
| --- | --- |
| **Priority** | Critical |
| **Module(s)** | Mobile (iOS), Compliance |
| **Complexity** | Medium |

**Problem**  
Profile has logout/edit but no delete account → App Store rejection risk.

**Approach**  
1. Profile → Account → Delete Account with confirmation + password re-entry.  
2. Call `DELETE /auth/me`; clear Keychain; return to signed-out.  
3. Link Privacy Policy (see `H-IOS-05`).

**Expected files**  
- `davayApp/davayApp/Features/MessagesProfile.swift` (ProfileView)  
- `davayApp/davayApp/Auth/AuthSession.swift`  
- `davayApp/davayApp/Core/APIClient.swift`  

**Dependencies**  
`C-API-06`.

**Acceptance criteria**  
- [ ] Signed-in user can delete account from Profile.  
- [ ] Confirmation required; success signs out.  
- [ ] Failure shows user-visible error.  

---

### C-IOS-05 — Ship real App Icon assets

| Field | Value |
| --- | --- |
| **Priority** | Critical |
| **Module(s)** | Mobile (iOS), App Store |
| **Complexity** | Small |

**Problem**  
`AppIcon.appiconset` has only `Contents.json` — no 1024×1024 (or required variants). Archive validation fails / placeholder icon.

**Approach**  
Add brand App Icon (1024 and any Xcode-required appearances). Validate Archive.

**Expected files**  
- `davayApp/davayApp/Assets.xcassets/AppIcon.appiconset/*`  

**Dependencies**  
None (needs design asset from stakeholder if missing).

**Acceptance criteria**  
- [ ] Xcode App Icon slot filled; Archive icon validation passes.  

---

### C-INF-01 — Introduce versioned Prisma migrations for production

| Field | Value |
| --- | --- |
| **Priority** | Critical |
| **Module(s)** | Database, Infrastructure, Developer experience |
| **Complexity** | Medium |

**Problem**  
Only `pnpm db:push`. `prisma.config.ts` references `prisma/migrations` but folder does not exist. Production schema changes are unversioned and hard to roll back.

**Approach**  
1. Baseline current schema into `prisma/migrations/..._init`.  
2. Add scripts: `db:migrate` / `db:migrate:deploy` using `prisma migrate`.  
3. Keep `db:push` for local prototype if desired, but document: **production = migrate deploy**.  
4. Update README + MIGRATION.md.  
5. Note: user rule prefers `db push` for agent day-to-day; for production readiness this task explicitly switches prod runbooks to migrate.

**Expected files**  
- `davay-api/prisma/migrations/**`  
- `davay-api/package.json`  
- `davay-api/README.md`  
- `davay-api/MIGRATION.md`  

**Dependencies**  
None. Do before schema-changing High tasks (`H-API-03`).

**Acceptance criteria**  
- [ ] Migration history exists and applies cleanly on empty DB.  
- [ ] Prod deploy docs use migrate deploy, not push.  
- [ ] `prisma migrate status` clean after apply.  

---

### C-INF-02 — CI pipeline for API (lint, typecheck, test, build)

| Field | Value |
| --- | --- |
| **Priority** | Critical |
| **Module(s)** | CI/CD, Backend/API |
| **Complexity** | Medium |

**Problem**  
No `.github/workflows` in the monorepo or `davay-api`. Regressions merge unchecked.

**Approach**  
1. GitHub Actions on PR/push: install pnpm, `lint`, `typecheck`, `test`, `build`.  
2. Optional Postgres service for future integration tests.  
3. Cache pnpm store.  
4. If monorepo root has no git remote unity: place workflow where the git root is (`davay-api` currently has its own `.git`).

**Expected files**  
- `.github/workflows/api-ci.yml` (at actual git root)  
- Possibly `davay-api/.github/workflows/ci.yml`  

**Dependencies**  
None. Strongly after first Critical API fixes so CI locks them in.

**Acceptance criteria**  
- [ ] PR CI runs and fails on lint/type/test/build errors.  
- [ ] Documented in README badge or Scripts section.  

---

## High Priority

Important missing functionality or architectural problems.

---

### H-API-01 — Atomic refresh-token rotation + reuse detection

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Backend/API, Auth, Security |
| **Complexity** | Medium |

**Problem**  
Refresh deletes old token then inserts new outside a single compare-and-swap; concurrent refresh can invalidate both sessions.

**Approach**  
Rotate in a transaction: delete by hash where exists; if 0 rows, treat as reuse → revoke all user refresh tokens; else issue new. Add tests for concurrent/reuse cases.

**Expected files**  
- `davay-api/src/routes/auth.ts`  
- `davay-api/src/lib/auth.ts`  
- `davay-api/src/routes/auth.test.ts`  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Concurrent refresh safe.  
- [ ] Reuse of rotated token revokes family.  

---

### H-API-02 — Normalize emails to lowercase

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Backend/API, Auth |
| **Complexity** | Small |

**Problem**  
Emails stored as provided; Postgres unique is case-sensitive → `User@x.com` and `user@x.com` both register.

**Approach**  
Lowercase+trim on register, login, forgot, user create paths. Optional one-time data cleanup script for existing rows.

**Expected files**  
- `davay-api/src/routes/auth.ts`  
- `davay-api/src/routes/users.ts`  
- Seed if needed  

**Dependencies**  
`C-API-01` preferred first.

**Acceptance criteria**  
- [ ] Duplicate case variants cannot both exist.  
- [ ] Login works regardless of typed case.  

---

### H-API-03 — DB uniqueness for reviews and pending offers

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Database, Backend/API |
| **Complexity** | Medium |

**Problem**  
Review duplicate check is app-level only; pending offers lack unique constraint → races create duplicates.

**Approach**  
Add `@@unique([authorId, requestId])` on Review (nullable requestId strategy carefully). Add unique partial or `@@unique([requestId, offererId])` with status handling (or unique where PENDING). Map Prisma `P2002` → 409 in `on-error.ts`.

**Expected files**  
- `davay-api/prisma/schema.prisma`  
- migration via `C-INF-01`  
- `davay-api/src/routes/requests.ts`  
- `davay-api/src/middleware/on-error.ts`  

**Dependencies**  
`C-INF-01`.

**Acceptance criteria**  
- [ ] Concurrent duplicate review/offer rejected at DB.  
- [ ] API returns 409 with clear code.  

---

### H-API-04 — Strict job progress transitions + completion rules

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Backend/API |
| **Complexity** | Small |

**Problem**  
Progress allows any forward jump (`nextIndex > currentIndex`). Owner can complete without `PROVIDER_DONE`.

**Approach**  
Allow only `current + 1`. Require `PROVIDER_DONE` (or document alternate) before owner complete. Tests for skip attempts.

**Expected files**  
- `davay-api/src/routes/requests.ts`  
- tests  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Skipping steps returns 400.  
- [ ] Invalid complete returns 400.  

---

### H-API-05 — Paginate messages, inbox, notifications; fix N+1 unread

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Backend/API, Performance, Mobile |
| **Complexity** | Large |

**Problem**  
Conversations list runs per-row unread counts; message history loads entirely; notifications/reviews poorly paginated.

**Approach**  
Cursor pagination (`limit` + `before`/`cursor`) on messages; aggregate unread in one query; mirror patterns on notifications. Update iOS clients to pass cursors (`H-IOS-02`).

**Expected files**  
- `davay-api/src/routes/conversations.ts`  
- `davay-api/src/routes/notifications.ts`  
- `davay-api/src/routes/users.ts` (reviews)  
- serializers/meta types  
- iOS Models + list loaders  

**Dependencies**  
Coordinate with `H-IOS-02`.

**Acceptance criteria**  
- [ ] Messages endpoint never returns unbounded full history by default.  
- [ ] Inbox unread without N+1.  
- [ ] Meta includes next cursor / hasMore.  

---

### H-API-06 — Map Prisma / JSON errors; request IDs

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Backend/API, Developer experience |
| **Complexity** | Medium |

**Problem**  
Unique/FK violations → opaque 500. Bad JSON → 500. No request-id correlation.

**Approach**  
In `on-error.ts`: map `P2002`→409, `P2025`→404, SyntaxError JSON→400. Middleware assigns `x-request-id`. Structured log field.

**Expected files**  
- `davay-api/src/middleware/on-error.ts`  
- `davay-api/src/app.ts`  
- `davay-api/src/middleware/request-id.ts` (new)  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Known Prisma errors not 500.  
- [ ] Responses/logs include request id.  

---

### H-API-07 — Payments integration for premium boost

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Backend/API, Third-party, Mobile, Product |
| **Complexity** | Large |

**Problem**  
`PREMIUM_BOOST` / `PAYMENT_RECEIVED` notification kinds unused; no monetization path after `C-API-05`.

**Approach**  
Choose provider (Stripe PaymentIntent / Apple IAP if digital goods policy applies—marketplace boost may be Stripe web). Webhook sets `isPremium` + expiresAt (add column). iOS “Boost” CTA. Idempotent webhooks.

**Expected files**  
- New `davay-api/src/routes/payments.ts`  
- schema (`premiumUntil`?)  
- iOS NewRequest / RequestDetail  
- env + README  

**Dependencies**  
`C-API-05`, `C-INF-01`.

**Acceptance criteria**  
- [ ] Premium only after verified payment.  
- [ ] Webhook idempotent.  
- [ ] Notification kinds used or removed from enum docs.  

---

### H-API-08 — Push notification sender (APNs)

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Backend/API, Mobile, Third-party |
| **Complexity** | Large |

**Problem**  
`DeviceToken` stored via `/devices` but nothing sends pushes. iOS never registers.

**Approach**  
APNs provider (token auth). On NEW_OFFER / NEW_MESSAGE / etc., enqueue send. Invalidate dead tokens. Pair with `H-IOS-03`.

**Expected files**  
- `davay-api/src/lib/push.ts` (new)  
- notification creation call sites in `requests.ts` / `conversations.ts`  
- env for APNs key  

**Dependencies**  
`H-IOS-03` for tokens to exist.

**Acceptance criteria**  
- [ ] Creating offer/message can deliver APNs to registered devices.  
- [ ] Failed tokens removed.  

---

### H-API-09 — Restrict / harden view counting

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Backend/API, Abuse |
| **Complexity** | Small |

**Problem**  
`POST /requests/:id/views` unauthenticated; no dedupe; owners can inflate.

**Approach**  
Require auth OR signed ephemeral id; ignore owner self-views; rate limit (see `C-API-02`); optional daily unique constraint table.

**Expected files**  
- `davay-api/src/routes/requests.ts`  

**Dependencies**  
`C-API-02` recommended.

**Acceptance criteria**  
- [ ] Trivial anonymous inflation mitigated.  
- [ ] Owner views do not increment.  

---

### H-API-10 — Upload MIME sniffing & safer Content-Type

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Backend/API, Security |
| **Complexity** | Medium |

**Problem**  
Upload trusts client `file.type`. Local GET forces image/*.

**Approach**  
Magic-byte sniff (file-type lib); reject mismatch; whitelist images (+ PDF for messages if supported); fix Content-Type map in `app.ts`.

**Expected files**  
- `davay-api/src/lib/storage.ts`  
- `davay-api/src/app.ts`  
- `davay-api/src/routes/uploads.ts`  

**Dependencies**  
`C-API-04` related.

**Acceptance criteria**  
- [ ] Spoofed MIME rejected.  
- [ ] Served Content-Type matches detected type.  

---

### H-API-11 — Email verification on register

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Backend/API, Auth |
| **Complexity** | Medium |

**Problem**  
No email verification → disposable/fake accounts, spam offers.

**Approach**  
`emailVerifiedAt` column; send verify link via mailer; block offers/messages until verified (or soft-limit). Resend endpoint rate-limited.

**Expected files**  
- schema + migration  
- `auth.ts`, mailer  
- iOS banner “verify email”  

**Dependencies**  
`C-API-03`, `C-INF-01`.

**Acceptance criteria**  
- [ ] Unverified users cannot perform high-abuse actions (define list).  
- [ ] Verify link works once.  

---

### H-IOS-01 — Call mark-read when opening conversation

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Mobile (iOS), Messaging, UX |
| **Complexity** | Small |

**Problem**  
`ConversationDetailView.load()` never calls `POST /conversations/:id/read` → sticky unread badges.

**Approach**  
After successful message fetch (and on appear), POST read; then `refreshInboxBadges()`.

**Expected files**  
- `davayApp/davayApp/Features/MessagesProfile.swift`  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Opening thread clears that conversation’s unread.  
- [ ] Tab badge updates.  

---

### H-IOS-02 — Pagination on Explore, messages, notifications

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Mobile (iOS), Performance, UX |
| **Complexity** | Large |

**Problem**  
Explore hard-caps `limit=50` with client-only filter; messages load all; misleading empty states.

**Approach**  
Use server `offset`/`cursor` + infinite scroll. Distinguish “filtered empty” vs “end of list”. Depends on API pagination (`H-API-05`) for messages.

**Expected files**  
- `ExploreView.swift`, `MessagesProfile.swift`, `MainShell.swift`  
- `Models.swift`  

**Dependencies**  
`H-API-05` for messages/inbox; Explore may already support offset—verify API.

**Acceptance criteria**  
- [ ] User can browse beyond first page.  
- [ ] Empty states accurate.  

---

### H-IOS-03 — Register APNs device tokens with `/devices`

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Mobile (iOS), Push |
| **Complexity** | Medium |

**Problem**  
API `/devices` unused. No entitlements/push capability.

**Approach**  
Enable Push capability; request authorization; on login register token; on logout DELETE; handle token refresh.

**Expected files**  
- New push helper  
- `davayAppApp.swift`, `AuthSession.swift`  
- entitlements  
- Info.plist usage strings if required  

**Dependencies**  
`H-API-08` for actual delivery (registration can land first).

**Acceptance criteria**  
- [ ] Logged-in device appears in `DeviceToken`.  
- [ ] Logout removes token.  

---

### H-IOS-04 — Confirm destructive actions (cancel / accept)

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Mobile (iOS), UX |
| **Complexity** | Small |

**Problem**  
Cancel request (and similar) without confirmation.

**Approach**  
`.confirmationDialog` / alert before cancel, withdraw, accept offer.

**Expected files**  
- `RequestDetailView.swift`  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Destructive actions require explicit confirm.  

---

### H-IOS-05 — Terms of Use + Privacy Policy entry points

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Mobile (iOS), Compliance, Documentation |
| **Complexity** | Small |

**Problem**  
No Terms/Privacy links on register or profile — App Store / GDPR expectation.

**Approach**  
Add links (SFSafariView / in-app markdown) from Register + Profile. Host pages externally if needed.

**Expected files**  
- `AuthViews.swift`, Profile in `MessagesProfile.swift`  
- Optional legal URLs in Info/config  

**Dependencies**  
Needs real policy URLs from product.

**Acceptance criteria**  
- [ ] Reachable from register and profile before/after signup.  

---

### H-IOS-06 — Lower or justify iOS 26.5 deployment target

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Mobile (iOS) |
| **Complexity** | Medium |

**Problem**  
`IPHONEOS_DEPLOYMENT_TARGET = 26.5` excludes nearly all devices for a public launch.

**Approach**  
Decide minimum (e.g. iOS 17/18); fix API availability; test on older simulators.

**Expected files**  
- `project.pbxproj`  
- Swift sources using newer-only APIs  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Target matches intended market; documented in README.  
- [ ] App builds for that target.  

---

### H-IOS-07 — Message polling or realtime while thread open

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Mobile (iOS), Messaging |
| **Complexity** | Medium |

**Problem**  
Chat is pull-once; users must leave/re-enter for new messages.

**Approach**  
Short-term: 3–5s poll while scene active. Long-term: WebSocket (`L-API-03`). Debounce badge refresh.

**Expected files**  
- `MessagesProfile.swift`, `AuthSession.swift`  

**Dependencies**  
`H-IOS-01` first.

**Acceptance criteria**  
- [ ] New messages appear within ~5s while thread open.  
- [ ] Badge refresh not spamming API.  

---

### H-IOS-08 — Universal Links / deep link password reset

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Mobile (iOS), Auth |
| **Complexity** | Medium |

**Problem**  
Reset requires manual token paste; `PASSWORD_RESET_URL` points at nonexistent web page.

**Approach**  
Associated Domains + `davay://reset?token=` or https applinks; open Reset screen with token. Align email template (`C-API-03`).

**Expected files**  
- entitlements, `davayAppApp.swift`, Auth flow  
- API `PASSWORD_RESET_URL`  

**Dependencies**  
`C-API-03`, `C-IOS-03`.

**Acceptance criteria**  
- [ ] Email link opens app Reset with token prefilled.  
- [ ] Manual paste still works as fallback.  

---

### H-IOS-09 — Unit tests for APIClient refresh + Keychain

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Mobile (iOS), Testing |
| **Complexity** | Medium |

**Problem**  
Zero iOS tests. Auth refresh coalescing is critical and untested.

**Approach**  
Add unit test target; URLProtocol mock; cover 401→refresh→retry once, refresh failure clears session, Keychain remember-me.

**Expected files**  
- New `davayAppTests/`  
- `project.pbxproj`  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] CI or local `xcodebuild test` covers refresh paths.  

---

### H-INF-01 — API Dockerfile + deployable compose / host docs

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Infrastructure & Deployment |
| **Complexity** | Medium |

**Problem**  
No Dockerfile for API; compose only Postgres/Redis; Vercel `handle` export unused without deploy config. Cannot reproducibly ship.

**Approach**  
Multi-stage Node 22 Dockerfile; compose `api` service; health/ready probes; secrets via env; document DigitalOcean/Fly/Render choice.

**Expected files**  
- `davay-api/Dockerfile`  
- `davay-api/docker-compose.yml`  
- `davay-api/README.md`  

**Dependencies**  
`C-INF-01` for migrate on boot strategy.

**Acceptance criteria**  
- [ ] `docker compose up` runs API + DB.  
- [ ] `/health` and `/health/ready` succeed.  

---

### H-INF-02 — Production CORS allowlist enforcement

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Backend/API, Security |
| **Complexity** | Small |

**Problem**  
`CORS_ORIGIN` defaults to `*`. Fine for pure Bearer mobile today; unsafe if web admin/cookies added.

**Approach**  
In `production`, refuse boot if `CORS_ORIGIN=*`. Document mobile-only exception if intentional.

**Expected files**  
- `davay-api/src/lib/env.ts`  
- `.env.example`, README  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Production with `*` fails fast at startup.  

---

### H-DOC-01 — Complete API README endpoint catalog

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Documentation |
| **Complexity** | Small |

**Problem**  
README omits conversations, devices, notifications, progress, reviews, many upload routes, auth stats.

**Approach**  
Full method/path/auth table matching routers.

**Expected files**  
- `davay-api/README.md`  

**Dependencies**  
Update again after Critical route changes.

**Acceptance criteria**  
- [ ] Every mounted route documented.  

---

### H-ADM-01 — Minimal admin / moderation capability

| Field | Value |
| --- | --- |
| **Priority** | High |
| **Module(s)** | Admin Panel (missing), Backend/API, Trust & Safety |
| **Complexity** | Large |

**Problem**  
No admin panel, no report/block, no content moderation. Marketplace will accumulate spam/abuse with no ops tools.

**Approach**  
Phase 1: `User.role` + `POST /reports` + admin-only routes to hide request / ban user (Bearer admin). Phase 2: simple web admin (Next.js) or Retool. Do not build full dashboard in Phase 1.

**Expected files**  
- schema, new `reports` routes  
- optional `davay-admin/` later  

**Dependencies**  
`C-INF-01`, auth hardening.

**Acceptance criteria**  
- [ ] User can report request/user.  
- [ ] Admin can hide request / suspend user via API.  
- [ ] No anonymous admin.  

---

## Medium Priority

Improvements, refactoring, UX enhancements, maintainability.

---

### M-API-01 — Expired token cleanup job

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Backend/API, Infrastructure |
| **Complexity** | Small |

**Problem**  
Expired refresh/reset tokens accumulate forever.

**Approach**  
Cron/interval or Redis-scheduled job deleting `expiresAt < now()`. Document in compose/cron.

**Expected files**  
- `davay-api/src/jobs/cleanup-tokens.ts`  
- `index.ts` or worker entry  

**Dependencies**  
Optional Redis from `C-API-02`.

**Acceptance criteria**  
- [ ] Expired tokens purged on schedule.  

---

### M-API-02 — Use Redis or remove from stack

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Infrastructure, Documentation |
| **Complexity** | Small |

**Problem**  
Redis in compose/README/env but zero application references → false ops burden.

**Approach**  
After rate-limit/cache: keep. Else remove service + env + docs.

**Expected files**  
- `docker-compose.yml`, `.env.example`, `README.md`, app code if used  

**Dependencies**  
`C-API-02` decision.

**Acceptance criteria**  
- [ ] Docs match reality: Redis used or gone.  

---

### M-API-03 — Category catalog: stop write-on-read upserts

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Backend/API, Performance |
| **Complexity** | Small |

**Problem**  
`ensureCategoryCatalog` upserts on category list / create request paths.

**Approach**  
Seed-only or migrate-time ensure; read path read-only.

**Expected files**  
- `category-catalog.ts`, `categories.ts`, `seed.ts`  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] GET `/categories` performs no writes in steady state.  

---

### M-API-04 — Deduplicate profile update endpoints

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Backend/API |
| **Complexity** | Small |

**Problem**  
`PATCH /auth/me` and `PATCH /users/:id` overlap.

**Approach**  
Keep `/auth/me`; deprecate `/users/:id` PATCH with 410 or thin proxy.

**Expected files**  
- `auth.ts`, `users.ts`, README, iOS if any  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Single documented profile update path.  

---

### M-API-05 — Stronger password policy

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Backend/API, Auth, Mobile |
| **Complexity** | Small |

**Problem**  
Min length 8 only.

**Approach**  
Require length + complexity or zxcvbn; mirror client validation; tests.

**Expected files**  
- `auth.ts`, AuthViews, shared rules docs  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Weak passwords rejected with field errors.  

---

### M-API-06 — Seed refuses production

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Database, Security |
| **Complexity** | Small |

**Problem**  
Seed creates `@davay.test` / `password123` with no `NODE_ENV` guard.

**Approach**  
Abort if `NODE_ENV=production` or `ALLOW_SEED≠true`.

**Expected files**  
- `prisma/seed.ts`  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Seed exits non-zero in production without override.  

---

### M-API-07 — Graceful shutdown

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Backend/API, Infrastructure |
| **Complexity** | Small |

**Problem**  
`index.ts` has no SIGTERM drain.

**Approach**  
Close server, disconnect Prisma on signal.

**Expected files**  
- `davay-api/src/index.ts`  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] SIGTERM exits cleanly without dropping in-flight beyond timeout.  

---

### M-API-08 — Pin Docker image tags

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Infrastructure |
| **Complexity** | Small |

**Problem**  
`postgres:latest` / `redis:latest` non-reproducible.

**Approach**  
Pin `postgres:16` (or 17) and `redis:7`.

**Expected files**  
- `docker-compose.yml`  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Tags pinned; README updated.  

---

### M-API-09 — Observability (errors + basic metrics)

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Infrastructure, Backend/API |
| **Complexity** | Medium |

**Problem**  
Only `console.error`; no Sentry/OTel/metrics.

**Approach**  
Sentry Node SDK or OpenTelemetry; RED metrics on `/metrics` (protect) or vendor.

**Expected files**  
- `app.ts`, `on-error.ts`, env, package.json  

**Dependencies**  
`H-API-06` request ids helpful.

**Acceptance criteria**  
- [ ] 500s visible in error tracker in staging.  

---

### M-API-10 — Integration tests for job lifecycle

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Testing, Backend/API |
| **Complexity** | Large |

**Problem**  
Tests are mocked unit/route only; no Postgres lifecycle coverage.

**Approach**  
Testcontainers or compose Postgres; offer→accept→progress→complete→review.

**Expected files**  
- `davay-api/src/**/*.integration.test.ts`  
- vitest config  
- CI service container  

**Dependencies**  
`C-INF-02`, `H-API-04`.

**Acceptance criteria**  
- [ ] Full happy-path job test green in CI.  

---

### M-IOS-01 — Public user profile + reviews screens

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Mobile (iOS) |
| **Complexity** | Medium |

**Problem**  
API `GET /users/:id` and `/reviews` unused; cannot inspect counterparties.

**Approach**  
Tap requester/offerer → profile + reviews list.

**Expected files**  
- New `UserProfileView.swift`, Models, navigation from RequestDetail  

**Dependencies**  
None (API exists).

**Acceptance criteria**  
- [ ] Profile + up to 50 reviews visible from request/offer UI.  

---

### M-IOS-02 — Defer location permission until opt-in on New Request

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Mobile (iOS), UX, Privacy |
| **Complexity** | Small |

**Problem**  
`NewRequestView` `.task { nearby.start() }` prompts location every compose.

**Approach**  
Default city center; “Use my location” button starts CLLocation.

**Expected files**  
- `NewRequestView.swift`  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] No location prompt until user opts in.  

---

### M-IOS-03 — Edit request + schedule picker

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Mobile (iOS), Backend if PATCH missing |
| **Complexity** | Medium |

**Problem**  
`scheduledAt` display-only; no edit/delete request.

**Approach**  
Add `PATCH /requests/:id` if missing; iOS edit form + DatePicker.

**Expected files**  
- `requests.ts`, `NewRequestView` / edit view, `RequestDetailView`  

**Dependencies**  
May need new API endpoint (include in this task).

**Acceptance criteria**  
- [ ] Owner can edit open request fields + schedule.  

---

### M-IOS-04 — Image caching + failure placeholders

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Mobile (iOS), Performance, UX |
| **Complexity** | Medium |

**Problem**  
Raw `AsyncImage`; weak failure UI; memory pressure on grids.

**Approach**  
Use URLCache or Nuke/Kingfisher if allowed; placeholder on fail.

**Expected files**  
- Shared `RemoteImage` view; call sites in Explore/Detail/Messages  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Failed loads show placeholder; scroll remains stable.  

---

### M-IOS-05 — Harden APIConfiguration base URL

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Mobile (iOS) |
| **Complexity** | Small |

**Problem**  
Force-unwrap `URL(string:)!` crashes on bad config.

**Approach**  
Validate scheme/host; surface recoverable error UI.

**Expected files**  
- `APIClient.swift`, `ContentView` / App entry  

**Dependencies**  
`C-IOS-01`.

**Acceptance criteria**  
- [ ] Bad URL does not crash; shows config error.  

---

### M-IOS-06 — Keychain accessibility on update + tighter accessibility

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Mobile (iOS), Security |
| **Complexity** | Small |

**Problem**  
Accessibility set only on insert; `AfterFirstUnlockThisDeviceOnly`.

**Approach**  
Set attributes on update; consider `WhenUnlockedThisDeviceOnly`.

**Expected files**  
- `APIClient.swift` (Keychain helpers)  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Update path preserves accessibility; tokens not readable while locked if policy chosen.  

---

### M-IOS-07 — Password change for signed-in users

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Mobile (iOS), Backend/API, Auth |
| **Complexity** | Medium |

**Problem**  
Only forgot-password flow; no in-app change password.

**Approach**  
`POST /auth/change-password` (current + new); Profile UI; revoke other sessions optional.

**Expected files**  
- `auth.ts`, Profile UI, AuthSession  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] User can change password while logged in.  

---

### M-IOS-08 — Accessibility pass (VoiceOver, Dynamic Type, Reduce Motion)

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Mobile (iOS), Accessibility, UI/UX |
| **Complexity** | Medium |

**Problem**  
Partial labels; skeleton ignores Reduce Motion; attachment-only messages weak a11y.

**Approach**  
Audit Explore map carousel, offer forms, chat attachments; honor `accessibilityReduceMotion`.

**Expected files**  
- Feature SwiftUI files  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Critical flows usable with VoiceOver.  
- [ ] Reduce Motion disables pulse animation.  

---

### M-REPO-01 — Unify monorepo git / root README

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Developer experience, Documentation |
| **Complexity** | Small |

**Problem**  
`davay-repo` contains `davay-api` (own `.git`) + `davayApp`; no root README explaining layout. No shared packages despite marketplace product.

**Approach**  
Root README architecture map; decide single git root vs submodules; document pnpm only for API.

**Expected files**  
- `/README.md` (new)  
- optionally `.gitignore` at root  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] New contributor knows how to run API + iOS in one page.  

---

### M-WEB-01 — Decide web presence (marketing / reset page)

| Field | Value |
| --- | --- |
| **Priority** | Medium |
| **Module(s)** | Frontend (missing), Auth |
| **Complexity** | Medium |

**Problem**  
`PASSWORD_RESET_URL` defaults to `http://localhost:3001/reset-password` but no web app exists. No marketing site.

**Approach**  
Either minimal static reset/landing pages or rely solely on app deep links (`H-IOS-08`) and remove web URL dependency.

**Expected files**  
- New `davay-web/` or update env docs  

**Dependencies**  
`C-API-03`, `H-IOS-08`.

**Acceptance criteria**  
- [ ] Reset URL in prod resolves to working page or app link.  

---

## Low Priority

Nice-to-have features and future improvements.

---

### L-API-01 — JWT iss/aud claims

| Field | Value |
| --- | --- |
| **Priority** | Low |
| **Module(s)** | Backend/API, Auth |
| **Complexity** | Small |

**Problem**  
Access JWTs lack `iss`/`aud`/`jti`.

**Approach**  
Add and verify claims in `lib/auth.ts`.

**Expected files**  
- `davay-api/src/lib/auth.ts`  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Tokens with wrong aud rejected.  

---

### L-API-02 — API versioning (`/v1`)

| Field | Value |
| --- | --- |
| **Priority** | Low |
| **Module(s)** | Backend/API |
| **Complexity** | Medium |

**Problem**  
Unversioned routes complicate breaking changes once public.

**Approach**  
Mount current routes at `/v1`; keep redirects or dual mount during transition; update iOS base paths.

**Expected files**  
- `app.ts`, iOS `APIClient`  

**Dependencies**  
Coordinate app release.

**Acceptance criteria**  
- [ ] Clients call `/v1/...`; old paths deprecated with timeline.  

---

### L-API-03 — WebSocket / SSE realtime messaging

| Field | Value |
| --- | --- |
| **Priority** | Low |
| **Module(s)** | Backend/API, Mobile, Performance |
| **Complexity** | Large |

**Problem**  
HTTP polling only (`H-IOS-07` is interim).

**Approach**  
Hono-compatible WS gateway; auth via token; subscribe conversation channels.

**Expected files**  
- new realtime module, iOS client  

**Dependencies**  
`H-IOS-07` interim OK first.

**Acceptance criteria**  
- [ ] Messages push to open clients without poll.  

---

### L-API-04 — OpenAPI / contract generation

| Field | Value |
| --- | --- |
| **Priority** | Low |
| **Module(s)** | Backend/API, Developer experience |
| **Complexity** | Medium |

**Problem**  
No machine-readable API contract; iOS models hand-maintained.

**Approach**  
`@hono/zod-openapi` or separate OpenAPI file; generate Swift optional later.

**Expected files**  
- openapi spec / route annotations  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] OpenAPI published in repo; covers auth + requests.  

---

### L-API-05 — Soft-delete + audit log

| Field | Value |
| --- | --- |
| **Priority** | Low |
| **Module(s)** | Backend/API, Admin, Compliance |
| **Complexity** | Large |

**Problem**  
Hard deletes via cascade; no audit trail for moderation.

**Approach**  
`deletedAt` on requests/users; admin audit table.

**Expected files**  
- schema, serializers, admin routes  

**Dependencies**  
`H-ADM-01`.

**Acceptance criteria**  
- [ ] Moderated content hideable without destroying evidence.  

---

### L-IOS-01 — Define AccentColor + branded launch screen

| Field | Value |
| --- | --- |
| **Priority** | Low |
| **Module(s)** | Mobile (iOS), UI/UX |
| **Complexity** | Small |

**Problem**  
AccentColor empty; generic launch.

**Approach**  
Brand color assets + launch screen.

**Expected files**  
- `Assets.xcassets`  

**Dependencies**  
`C-IOS-05` related.

**Acceptance criteria**  
- [ ] Accent renders consistently; launch not blank white only.  

---

### L-IOS-02 — Localization (Estonian + English)

| Field | Value |
| --- | --- |
| **Priority** | Low |
| **Module(s)** | Mobile (iOS) |
| **Complexity** | Large |

**Problem**  
App is English-only; product cities are Estonian.

**Approach**  
String catalogs; ET + EN.

**Expected files**  
- `Localizable.xcstrings`, UI strings  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Device language switches primary UI strings.  

---

### L-IOS-03 — Crash reporting + analytics

| Field | Value |
| --- | --- |
| **Priority** | Low |
| **Module(s)** | Mobile (iOS), Observability |
| **Complexity** | Medium |

**Problem**  
No crash/analytics SDK.

**Approach**  
Sentry/TelemetryDeck/Firebase; privacy-reviewed events.

**Expected files**  
- App entry, SPM packages  

**Dependencies**  
`H-IOS-05` privacy policy should mention.

**Acceptance criteria**  
- [ ] Crashes visible in dashboard for TestFlight builds.  

---

### L-IOS-04 — Settings: version, support, licenses

| Field | Value |
| --- | --- |
| **Priority** | Low |
| **Module(s)** | Mobile (iOS) |
| **Complexity** | Small |

**Problem**  
Profile lacks version/support/OSS licenses.

**Approach**  
Standard settings section.

**Expected files**  
- Profile / Settings view  

**Dependencies**  
None.

**Acceptance criteria**  
- [ ] Version string + support email visible.  

---

### L-IOS-05 — Certificate pinning (optional)

| Field | Value |
| --- | --- |
| **Priority** | Low |
| **Module(s)** | Mobile (iOS), Security |
| **Complexity** | Medium |

**Problem**  
No pinning once HTTPS host stable.

**Approach**  
Pin SPKI hashes with backup pin; document rotation.

**Expected files**  
- `APIClient.swift` / URLSession delegate  

**Dependencies**  
`C-IOS-01` stable host.

**Acceptance criteria**  
- [ ] MITM with custom CA fails closed in Release.  

---

### L-IOS-06 — Sign in with Apple (if adding social IdPs)

| Field | Value |
| --- | --- |
| **Priority** | Low |
| **Module(s)** | Mobile (iOS), Auth |
| **Complexity** | Medium |

**Problem**  
Email/password only. Apple required if other social logins added.

**Approach**  
Defer until Google/Facebook planned; then SIWA + API identity link.

**Expected files**  
- Auth UI, API social endpoints  

**Dependencies**  
Product decision.

**Acceptance criteria**  
- [ ] SIWA works end-to-end if social login ships.  

---

### L-PROD-01 — Geo search / radius filter for requests

| Field | Value |
| --- | --- |
| **Priority** | Low |
| **Module(s)** | Backend/API, Mobile, Product |
| **Complexity** | Large |

**Problem**  
List by city enum only; lat/lng unused server-side for search.

**Approach**  
PostGIS or haversine + indexes; Explore “Near me” server filter.

**Expected files**  
- schema/indexes, `requests.ts`, ExploreView  

**Dependencies**  
`H-IOS-02`.

**Acceptance criteria**  
- [ ] API supports radius query; Explore uses it.  

---

### L-PROD-02 — Block / mute users

| Field | Value |
| --- | --- |
| **Priority** | Low |
| **Module(s)** | Backend/API, Mobile, Trust |
| **Complexity** | Medium |

**Problem**  
No user block; messaging abuse remains after `C-API-04` baseline.

**Approach**  
`UserBlock` table; filter offers/messages/explore.

**Expected files**  
- schema, routes, iOS profile actions  

**Dependencies**  
`C-API-04`, `H-ADM-01`.

**Acceptance criteria**  
- [ ] Blocked users cannot message blocker.  

---

### L-DX-01 — Shared API types package

| Field | Value |
| --- | --- |
| **Priority** | Low |
| **Module(s)** | Shared packages (missing) |
| **Complexity** | Large |

**Problem**  
No shared packages; Swift models duplicated by hand from Zod/Prisma.

**Approach**  
OpenAPI → Swift generate, or zod→json-schema. Only worth after `L-API-04`.

**Expected files**  
- `packages/api-types` or codegen pipeline  

**Dependencies**  
`L-API-04`.

**Acceptance criteria**  
- [ ] Client models generated from single contract.  

---

## Implementation notes for the next agent

1. **Do not implement product scope expansion** (new cities, redesign) unless a task says so.  
2. **Security Critical first** — especially `C-API-01`, `C-API-02`, `C-API-04`, `C-IOS-01`, `C-IOS-02`.  
3. **No admin/web today** — `H-ADM-01` / `M-WEB-01` are greenfield.  
4. **Tests:** API uses Vitest; iOS has none until `H-IOS-09`.  
5. **pnpm** for API; **no npm/yarn**.  
6. After schema changes: `pnpm db:generate` and migrate/push per `C-INF-01` status.  
7. Cross-check companion docs: `PROJECT_HEALTH_REPORT.md`, `FEATURE_GAP_ANALYSIS.md`, `TECHNICAL_DEBT.md`.

## Task index (quick)

| ID | Title | Priority | Complexity |
| --- | --- | --- | --- |
| C-API-01 | Remove POST /users | Critical | S |
| C-API-02 | Rate limiting | Critical | M |
| C-API-03 | Password reset email | Critical | M |
| C-API-04 | Messaging + private files | Critical | L |
| C-API-05 | Server-side premium only | Critical | M |
| C-API-06 | Account deletion API | Critical | M |
| C-IOS-01 | HTTPS Release URL | Critical | S |
| C-IOS-02 | Strip seed logins | Critical | S |
| C-IOS-03 | Gate reset tokens | Critical | S |
| C-IOS-04 | Account deletion UI | Critical | M |
| C-IOS-05 | App Icon | Critical | S |
| C-INF-01 | Prisma migrations | Critical | M |
| C-INF-02 | API CI | Critical | M |
| H-API-01…11 | Auth/DB/payments/push/uploads | High | S–L |
| H-IOS-01…09 | Mark-read/push/pagination/tests | High | S–L |
| H-INF-01…02 | Docker/CORS | High | S–M |
| H-DOC-01 | README endpoints | High | S |
| H-ADM-01 | Admin/moderation | High | L |
| M-* | Maintainability/UX | Medium | S–L |
| L-* | Future / polish | Low | S–L |
