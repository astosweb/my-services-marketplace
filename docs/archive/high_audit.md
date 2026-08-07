# Path to 90+ Audit Scores

**Baseline (post-remediation):** Overall **84%** · Production readiness **78%**  
**Target:** Overall **≥ 90%** · Production readiness **≥ 90%**  
**Source:** [`PROJECT_AUDIT_REPORT.md`](./PROJECT_AUDIT_REPORT.md)

Gap to close: **~6 overall points** and **~12 production-readiness points**. Below is the minimum work that actually moves those numbers — not a wishlist.

---

## Score math (what is dragging)

| Area | Now | Need for 90+ blend | Biggest lever |
|------|----:|-------------------:|---------------|
| Testing | 62 | ≥ 85 | E2E + broader API/integration coverage |
| DevOps | 76 | ≥ 90 | APM, automated backups, staging soak evidence |
| Frontend (web) | 78 | ≥ 88 | Map explore + fewer UX gaps |
| Mobile (iOS) | 78 | ≥ 88 | Search + basic tests or documented QA checklist |
| Security | 82 | ≥ 90 | Token denylist / MIME sniff / staging proof |
| Completeness | 82 | ≥ 90 | Decide payments: ship MVP or explicitly exclude from score |
| Production readiness | 78 | ≥ 90 | Ops evidence + observability + migration discipline |

Payments alone should **not** block 90 if product scope stays “coordinate, don’t process money” — but then completeness scoring must treat payments as **out of scope**, not missing.

---

## Must-do for ≥ 90 (ordered)

### 1. Testing & quality gates — lifts Testing 62 → ~88

Without this, overall stays under 90.

| Work | Why | Complexity |
|------|-----|------------|
| Playwright smoke: register/login → create request → offer → accept → progress → review | Proves README domain loop on web | High |
| API integration tests (supertest) for auth refresh rotation, admin guard, offer unique conflict | Catches contract regressions | Medium |
| CI: fail PR if api/admin/web tests fail; add coverage floor on API critical modules (~60%+ on auth/requests/support) | Makes quality enforceable | Medium |
| Optional: one XCUITest or documented manual iOS regression checklist committed | Raises mobile confidence | Medium |

**Exit criteria:** Green CI on every PR with E2E smoke + unit/integration; documented how to run locally.

---

### 2. Observability & ops evidence — lifts DevOps 76 → ~92 and readiness → ~90

| Work | Why | Complexity |
|------|-----|------------|
| APM/error tracking (Sentry or equivalent) on API + web + admin | Blind production is the #1 readiness gap | Medium |
| Uptime checks on `GET /health` and `GET /health/ready` | Detects DB/Redis outages | Low |
| Automated Postgres backups + restore drill write-up (with date) | Turns `docs/DEPLOYMENT.md` into proven practice | Medium |
| Staging soak checklist signed off: Resend, Spaces, APNs, `COOKIE_SECURE`, CORS allowlist | Verifies what static audit cannot | Medium |
| If policy requires migrations: generate reviewed SQL from current schema (stop relying only on `db push` in prod) | Removes Critical C3b residual | High |

**Exit criteria:** Errors visible in APM; backup restore tested once; staging checklist completed and linked from DEPLOYMENT.md.

---

### 3. Security hardening — lifts Security 82 → ~92

| Work | Why | Complexity |
|------|-----|------------|
| Shorten access JWT TTL and/or Redis denylist (or version bump) on logout | Stolen access tokens currently live until expiry | Medium |
| MIME/magic-byte sniffing for non-image message/support uploads | Don’t trust client `mimetype` alone | Medium |
| Rate-limit / abuse review on public browse + view counters under load | Softens scraping / inflation | Medium |
| Document threat model (auth cookies, BFF, Spaces ACLs) in 1–2 pages | Shows intentional security posture | Low |

**Exit criteria:** Logout invalidates usable access quickly; upload types verified by content; short threat-model doc exists.

---

### 4. Product parity (scoped) — lifts Completeness / Web / iOS → ~90

Do these **only if** they remain in-scope for the product score:

| Work | Surface | Complexity |
|------|---------|------------|
| Web Explore map (Mapbox/Leaflet) parity with iOS MapKit | Web | High |
| Free-text Explore search (API `q=` or honest client search) on iOS + web | iOS/Web | Medium |
| Web Push / device registration (optional if PWA not planned — document exclusion) | Web | Medium |
| Typing indicators via Redis pub/sub (replace in-memory) | API | Medium |
| Realtime messaging (SSE or WebSocket) — **nice for 95**, not strictly required for 90 if polling is documented as MVP | API/clients | High |

**Exit criteria:** Feature matrix in README matches all launch clients for in-scope flows; remaining gaps labeled “post-90 / v2”.

---

### 5. Architecture consistency — lifts Architecture ~84 → ~91

| Work | Why | Complexity |
|------|-----|------------|
| Single validation source: generate Nest DTOs from shared Zod **or** Zod on Nest boundary | Ends dual-validator drift risk | High |
| Contract tests: shared schemas vs OpenAPI/Swagger snapshot | Prevents silent API breaks for iOS | Medium |
| Soft-delete or anonymize users without wiping related audit (already SetNull — extend to support activities if needed) | Compliance polish | Low–Medium |
| Naming cleanup (Gobid rebrand) — can stay Nice-to-have for 90 | Clarity | High |

**Exit criteria:** One authoritative contract path + CI contract check.

---

### 6. Production readiness checklist (explicit 90 gate)

Treat readiness as a **binary gate**, not a vibe score. All must be true:

- [ ] Staging soak passed (email, uploads, push, cookies, CORS)
- [ ] APM live with alert on error spike
- [ ] Backup + restore drilled within last 90 days
- [ ] Schema change process documented and used once successfully
- [ ] E2E smoke in CI on main
- [ ] Secrets rotated / not example values in prod env
- [ ] Load smoke: login + list requests + create offer at expected concurrency
- [ ] On-call / owner listed for API, Spaces, Postgres

When this list is checked, **Production readiness ≥ 90** is justified even without payments.

---

## Explicitly out of scope for 90 (unless product changes)

Do **not** block 90+ on these if README/FAQ keep them deferred:

- Payments / escrow / payouts / Stripe
- Full multi-role server RBAC (Manager/Editor) — binary ADMIN is honest today
- Feature-flag product
- Full offline iOS mode
- ~~Brand rename~~ (done — Gobid / gobid.ee)

Mark each “Out of scope — v2” in README so completeness scoring does not penalize them.

---

## Suggested sequencing (shortest path to 90)

```
Week A  E2E smoke + CI gates + APM + uptime
Week B  Staging soak + backup drill + security (logout/MIME)
Week C  Web map OR search parity + contract tests
Week D  Re-score PROJECT_AUDIT_REPORT; ship if gates pass
```

**Minimum viable 90 package:** items **1 + 2 + 3 + readiness checklist**, plus README scope clarity on payments. Items **4–5** push overall from ~90 toward **93–95**.

---

## Expected scores after MVP-90 package

| Metric | Now | After 1+2+3 + checklist | After + map/search/contracts |
|--------|----:|------------------------:|-----------------------------:|
| Overall | 84 | **~91** | **~94** |
| Production readiness | 78 | **~92** | **~93** |
| Testing | 62 | ~88 | ~90 |
| DevOps | 76 | ~92 | ~93 |
| Security | 82 | ~91 | ~93 |

---

## Tracking

Open issues (or a single epic) named:

1. `test: playwright marketplace smoke + CI`
2. `ops: sentry + uptime + backup drill`
3. `sec: logout token invalidation + upload sniffing`
4. `docs: mark payments/RBAC/offline as v2 for scoring`
5. `feat: web map explore` (optional for 90, required for ~94 completeness)

Re-run / update [`PROJECT_AUDIT_REPORT.md`](./PROJECT_AUDIT_REPORT.md) only after exit criteria are met — do not inflate scores on plans alone.
