# Bidy — Project Audit Report

**Date:** 2026-08-05 (remediation pass same day)  
**Scope:** Full monorepo (`apps/api`, `apps/admin`, `apps/web`, `packages/shared`, `ios-app`, Docker/CI)  
**Baseline documents:** Root [`README.md`](./README.md), [`apps/api/README.md`](./apps/api/README.md), [`apps/admin/README.md`](./apps/admin/README.md), [`ios-app/README.md`](./ios-app/README.md), [`AGENTS.md`](./AGENTS.md)  
**Method:** Static source review, then remediation of Critical/High findings with unit tests and typechecks. Runtime APNs/Resend/Spaces delivery was **not** exercised end-to-end.

---

## Executive Summary

Bidy is a NestJS-centered marketplace monorepo with a strong API domain model, admin/support ops, public web, and SwiftUI client. A remediation pass closed the highest-risk audit gaps: **admin docs rewritten**, **fake auth templates removed**, **BFF CSRF + path allowlists**, **web job lifecycle + support**, **schema integrity (uniques/indexes/audit retention)**, **shared↔Nest contract alignment**, **frontend CI**, **env examples**, and **deployment/backup notes**.

Remaining intentional/deferred items: payments/escrow, realtime messaging, map-on-web, offline iOS, multi-role server RBAC (honestly documented as binary), and full E2E/APM.

| Score | Value | Prior |
|-------|------:|------:|
| **Overall Score** | **84 / 100** | 62 |
| **Production Readiness Score** | **78 / 100** | 54 |

---

## Overall Score (84%)

| Area | Score | Prior | Notes |
|------|------:|------:|-------|
| Project completeness vs README concept | 82 | 58 | Web lifecycle + support closed; map/payments still out |
| Architecture & maintainability | 84 | 72 | Docs/AGENTS aligned; less template debt |
| Security | 82 | 64 | CSRF + allowlists + banned profile filter |
| Database | 86 | 68 | Offer/review uniques; refresh index; audit SetNull |
| API quality | 86 | 78 | Ready checks Redis; conversation pagination |
| Frontend (web) | 78 | 52 | Offers/progress/review/support live |
| Admin panel | 84 | 66 | Accurate README; mock settings redirected |
| Mobile (iOS) | 78 | 74 | README search claim fixed |
| DevOps | 76 | 55 | Frontend CI + deployment/backup doc |
| Testing | 62 | 40 | Web CSRF tests; still no E2E |
| Documentation | 88 | 55 | Root/admin/AGENTS/DEPLOYMENT accurate |

---

## Production Readiness Score (78%)

**Justification:** Ready for a **controlled public beta** of API + admin + web + iOS without payments. Staging still needs: soak-test Resend/APNs/Spaces, production backup automation on the host, optional APM, and a dry-run of `db push` (or reviewed migration) against a snapshot. Not a hard launch blocker if payments remain out of scope and ops follow `docs/DEPLOYMENT.md`.

---

## Remediation changelog (this pass)

| ID | Fix | Status |
|----|-----|--------|
| C1 | Rewrite `apps/admin/README.md` + AGENTS; add root `AGENTS.md` | Done |
| C2 | Same-origin CSRF checks + Nest path allowlists on web/admin BFF | Done |
| C3 | Document push-first schema + backup runbook in `docs/DEPLOYMENT.md` | Done (ops doc; SQL migration regen deferred) |
| C4 | Web: accept/decline/withdraw offers, progress, complete/cancel, reviews, chat | Done |
| C5 | Delete `sign-in-2/3`, `forgot-password-2/3` templates | Done |
| H1 | Honest binary RBAC copy (roles page + README) | Done |
| H2 | `.github/workflows/frontend-ci.yml` for admin + web | Done |
| H3 | `/health/ready` pings Redis when configured | Done (APM still deferred) |
| H4 | `@@unique` offers/reviews; `RefreshToken.expiresAt` index; AuditLog `SetNull` | Done |
| H5 | Align `@monorepo/shared` Zod with Nest DTO limits + lifecycle schemas | Done |
| H6 | Backup/restore notes in deployment doc | Done |
| H7 | Web `/support` list + detail + settings link | Done |
| M1 | Conversations list `limit`/`offset`/`total` meta | Done |
| M4 | Mock settings → redirect to account | Done |
| M6 | iOS README search wording | Done |
| M7 | `apps/web` + `apps/admin` `.env.example` | Done |
| M8 | Support attachment `sizeBytes` via object HEAD/stat | Done |
| M9 | Root `AGENTS.md` | Done |

---

## Architecture Review

### Strengths

- Monorepo layout matches root README; single Prisma schema; BFF + Nest + iOS Bearer as documented.
- Shared package contracts aligned with Nest limits after remediation.
- Admin no longer claims a parallel Prisma/Tasks world.

### Remaining concerns

| Issue | Detail |
|-------|--------|
| Dual validators | Zod (clients) + class-validator (Nest) — limits synced; still two systems |
| Naming mix | `@hero/api` / Bidy / hero seed emails |
| Typing indicators | Still in-memory across instances |
| Payments | Explicitly deferred |

---

## Feature Gap Analysis (post-fix)

| Step | API | Admin | Web | iOS |
|------|:---:|:-----:|:---:|:---:|
| Create request | ✅ | ✅ | ✅ | ✅ |
| Browse list | ✅ | ✅ | ✅ | ✅ |
| Browse map | — | — | ❌ | ✅ |
| Submit / manage offers | ✅ | ✅ | ✅ | ✅ |
| Messaging | ✅ | ✅ | ✅ poll | ✅ |
| Job progress | ✅ | — | ✅ | ✅ |
| Complete + review | ✅ | ✅ | ✅ | ✅ |
| Support | ✅ | ✅ | ✅ | ✅ |
| Push | ✅ | — | ❌ | ✅ |
| Payments | ❌ | ❌ | ❌ | ❌ |

---

## Security Review (post-fix)

**Positives:** prior Nest hardening + new BFF CSRF/allowlists, banned users hidden on public profiles, support size metadata, honest RBAC docs.

**Remaining:** no access-token denylist on logout; document MIME still client-reported for non-images; no APM; catch-all still exists but allowlisted.

---

## Performance / DB

- Offer/review uniqueness at DB layer; refresh-token expiry indexed.
- Conversation inbox paginated in-memory after load (fine for typical inbox sizes).
- No response cache layer; polling chat only.

---

## Testing

| Suite | Status |
|-------|--------|
| API unit | 11 files / 35 tests — passing |
| Admin unit | 6 files / 13 tests — passing |
| Web unit | CSRF helpers — 4 tests — passing |
| E2E | Still absent |
| iOS XCTest | Still absent |

---

## Missing / deferred features

1. Payments / escrow  
2. Web map explore + web push  
3. Realtime messaging  
4. Server-side favorites  
5. Multi-role **server** RBAC (product choice)  
6. Feature flags product  
7. E2E + APM  
8. Regenerated SQL migration history for regulated deploys  

---

## Recommended Improvements (remaining)

## 🔴 Critical

*None open for a payments-free beta if staging soak + backups are executed.*

### C3b. Optional: regenerate Prisma SQL migrations for regulated prod

- **Severity:** Critical only if policy forbids `db push`  
- **Description:** Migration folder still lags schema; project standard remains `db push` with backup.  
- **Recommended solution:** Offline `migrate diff` → reviewed SQL when required by host.  
- **Complexity:** High  

## 🟠 High Priority

### H3b. Add APM / error tracking

- **Severity:** High  
- **Description:** No Sentry/OTel in app code.  
- **Complexity:** Medium  
- **Files:** API/web/admin bootstraps  

### H8. E2E smoke (Playwright)

- **Severity:** High  
- **Description:** Auth + create request + offer accept path.  
- **Complexity:** High  

## 🟡 Medium Priority

### M10. Web map explore parity with iOS  
### M11. Access-token denylist / shorter access TTL  
### M12. MIME sniffing for non-image uploads  

## 🟢 Nice to Have

### N1. Realtime chat · N2. Offline iOS · N3. Brand/`hero` rename · N4. Payments epic  

---

## Risks Before Launch

| Risk | Mitigation |
|------|------------|
| `db push` on shared prod DB | Snapshot + `docs/DEPLOYMENT.md` |
| Email/APNs/Spaces misconfig | Staging soak |
| Payments expectation | Keep FAQ / no pay UI |
| No APM | H3b before heavy traffic |

---

## Prioritized Roadmap

### Done (this PR)

Critical/High items C1–C5, H1–H2, H4–H7, docs, CSRF, web lifecycle, frontend CI.

### Next

1. Staging soak (Resend, Spaces, APNs, `COOKIE_SECURE`)  
2. APM + uptime on `/health/ready`  
3. Playwright smoke  
4. Map-on-web / payments when product prioritizes  

---

## Appendix — Verification

Commands run after remediation:

- `pnpm --filter @hero/api test` → 35 passed  
- `pnpm --filter admin-panel test` → 13 passed  
- `pnpm --filter web test` → 4 passed  
- Typecheck: api, admin, web, shared → clean  

*End of report.*
