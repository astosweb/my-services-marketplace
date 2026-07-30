# Apple App Store Release Readiness Report

**App:** heroApp (`com.serhatsabuncu.heroApp`)  
**Date:** 2026-07-30  
**Verdict:** **Not ready to release.** Core marketplace flows exist, but several hard blockers will fail Archive validation, App Review, or leave the app non-functional for reviewers.

---

## Executive summary

heroApp is a functional SwiftUI client for the NestJS marketplace API (auth, explore/map, requests, offers, messages, profile, account deletion). It is still configured as a **local development build**: Release points at `http://127.0.0.1:3000`, seed-login buttons ship on the Sign In screen, App Icon assets are empty, and there is no Privacy Policy / Terms. Password reset cannot email users in production.

Ship only after the **Blockers** below are done, then complete High / Medium items before submitting.

---

## Blockers (must fix before submission)

### 1. Production API URL (Release still uses localhost)

| Item | Current state |
|------|----------------|
| Debug + Release `HERO_API_BASE_URL` | `http://127.0.0.1:3000` in `project.pbxproj` |
| Fallback in `APIClient.swift` | `http://127.0.0.1:3000` |
| ATS | `NSAllowsLocalNetworking` enabled in `Info.plist` |

**Required:**
- Deploy a production HTTPS API (see Backend section).
- Set **Release** `HERO_API_BASE_URL` to `https://your-api.example.com`.
- Keep localhost / LAN only in Debug.
- Prefer removing or Release-gating `NSAllowsLocalNetworking` for shipping builds.

Without this, TestFlight / App Review installs cannot load data.

### 2. Remove seed / demo login from shipping UI

`AuthViews.swift` shows **Quick seed login** with hardcoded credentials:

- `moonika@hero.test` / `raivo@hero.test`
- password `password123`

**Required:** delete these controls, or wrap them in `#if DEBUG`. Leaving them is a Guideline **2.1** (incomplete / demo) rejection risk.

### 3. App Icon assets missing

`Assets.xcassets/AppIcon.appiconset/` has `Contents.json` only — **no PNG files**.

**Required:** add at least a **1024×1024** App Store icon (plus dark/tinted variants if you want). Archive / upload will fail or be rejected without this.

### 4. Privacy Policy (+ Terms) missing

No in-app Privacy Policy or Terms links. No hosted legal pages found in the repo.

**Required:**
- Host a Privacy Policy URL (and Terms for a UGC marketplace).
- Add links on Register / Profile (and login if useful).
- Enter the Privacy Policy URL in App Store Connect.

Account creation, location, photos, and messages mean Connect privacy answers are mandatory.

### 5. Password reset does not work for real users

API creates a reset token, but **only returns `token` / `resetLink` when `NODE_ENV !== "production"`**. There is **no email sender** (no SMTP / Resend / etc.).

**Required for a complete auth product:**
- Integrate transactional email.
- Send reset link to the user in production.
- Point `PASSWORD_RESET_URL` at a real reset page or deep link the iOS app can open.
- Until then, either hide Forgot Password in production or document it as known-broken (Review may still reject incomplete auth).

### 6. Production backend must be live and configured

The app is a thin client. Without a reachable API, nothing works after launch.

**Minimum production API checklist (`apps/api`):**

| Requirement | Notes |
|-------------|--------|
| `NODE_ENV=production` | |
| Strong `JWT_SECRET` (≥32 chars) | Not the example value |
| `DATABASE_URL` on managed Postgres | |
| Redis (`REDIS_URL`) or explicit `RATE_LIMIT_ALLOW_MEMORY=true` | Prefer Redis |
| `CORS_ORIGIN` not `*` | Production boot refuses `*` |
| `UPLOAD_STORAGE=spaces` + Spaces credentials | Avoid local disk in prod |
| `API_PUBLIC_URL` / CDN URLs | Correct HTTPS media URLs for the app |
| HTTPS termination | Required for App Transport Security |
| Do not enable `ALLOW_SEED` in production | |

---

## High priority (strongly recommended before 1.0)

| # | Item | Why |
|---|------|-----|
| 1 | Set display name | Bundle shows `heroApp`; set `CFBundleDisplayName` / marketing name (e.g. “Hero”). |
| 2 | Shared Xcode scheme | Only user-local scheme found; add a shared Archive scheme for CI / other Macs. |
| 3 | App Store Connect privacy labels | Declare Account, Location, Photos/User Content, Identifiers as needed; no ATT/tracking SDKs found (good). |
| 4 | Screenshots + preview | Required for listing (6.7" + other sizes you support). |
| 5 | Support URL + marketing URL | App Store Connect metadata. |
| 6 | Reviewer demo account | Provide working email/password in Review notes (not seed UI). |
| 7 | iOS deployment target | `IPHONEOS_DEPLOYMENT_TARGET = 26.5` limits audience severely — confirm intentional or lower it. |
| 8 | Export compliance | Answer encryption questionnaire (standard HTTPS-only usually qualifies for exemption). |

---

## Medium priority (quality / App Review polish)

| # | Item | Notes |
|---|------|-------|
| 1 | `PrivacyInfo.xcprivacy` | Add if required-reason APIs apply; currently no third-party SDKs. |
| 2 | Push notifications | Backend has `/devices`; app never registers. Wire up or remove unused API surface from product claims. |
| 3 | Offline UX | No reachability banner; requests fail fast. Acceptable for v1 if errors are clear. |
| 4 | UGC moderation path | Marketplace with user photos/messages — Review may ask how abuse is handled (report/block). Add if missing. |
| 5 | Location accuracy copy | New requests can fall back to city center when GPS is unavailable — ensure UX is clear. |
| 6 | Unit / UI tests | No test targets in the Xcode project. |
| 7 | Sign in with Apple | Not required for pure email/password (Guideline 4.8), optional for trust/conversion. |
| 8 | Launch screen polish | Using generated launch screen — fine for v1; brand it when iconing. |

---

## What is already in good shape

- Email/password register, login, refresh (coalesced on 401), logout
- Remember Me + refresh token in Keychain
- **Account deletion** (`DELETE /auth/me` + password) — satisfies Apple’s account-deletion expectation when production API is live
- Explore list/map, request detail, create request, offers, messaging, profile/stats
- Location usage string present (`NSLocationWhenInUseUsageDescription`)
- Typed API errors, empty states, pull-to-refresh on main screens
- No StoreKit / IAP complexity (budgets/offers are peer negotiation, not App Store purchases)
- No analytics / ATT tracking SDKs detected
- No client-side API secrets (JWT handled as session tokens)

---

## Apple Developer / App Store Connect checklist

Use this when the code blockers above are done:

1. **Apple Developer Program** membership active (paid).
2. **App ID** `com.serhatsabuncu.heroApp` registered (capabilities as needed).
3. **Certificates / profiles** — Automatic signing with team `5HLELC5KYS` is set; verify for Distribution / App Store Connect.
4. Create **App Store Connect** app record (name, bundle ID, SKU, primary locale).
5. Fill **Privacy Policy URL**, category, age rating, contact info.
6. Complete **App Privacy** nutrition labels.
7. Upload **App Icon** + screenshots.
8. Archive **Release** build with production `HERO_API_BASE_URL`.
9. Upload via Xcode / Transporter → **TestFlight** internal test.
10. External TestFlight (optional) → submit for **App Review** with demo account + notes.

**Version today:** marketing `1.0`, build `1`.

---

## Suggested completion order

```
1. Deploy production API (HTTPS, JWT, DB, Redis, Spaces)
2. Implement password-reset email
3. Point Release HERO_API_BASE_URL at production HTTPS
4. Remove / #if DEBUG seed login
5. Add App Icon (1024)
6. Host Privacy Policy + Terms; link in app + Connect
7. Set display name; confirm deployment target
8. Screenshots, metadata, demo account
9. TestFlight → App Review
```

---

## Effort estimate (rough)

| Workstream | Effort |
|------------|--------|
| Release URL + remove seed login + display name | Small (hours) |
| App Icon + screenshots + Connect metadata | Small–medium (design dependent) |
| Privacy Policy / Terms (legal + links) | Small–medium |
| Production API deploy (infra + env) | Medium |
| Password-reset email | Medium |
| Push / report-abuse / tests (optional) | Larger, post-1.0 OK |

---

## Bottom line

**Do not submit to App Store yet.** Closest path to a releasable 1.0:

1. Live HTTPS API  
2. No demo seed UI  
3. Real App Icon  
4. Privacy Policy (+ Terms)  
5. Working password reset (or remove the flow until email exists)

After those five, the app is in shape for TestFlight and a serious App Review attempt; remaining items are polish and Connect paperwork.
