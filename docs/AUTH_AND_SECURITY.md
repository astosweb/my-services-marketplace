# Authentication & Security Specification

## Overview

Gobid implements a multi-tier authentication and security architecture tailored to its frontends (Web & Admin BFF cookies) and native mobile client (iOS Bearer JWT), backed by NestJS security guards and HMAC file signing.

---

## 1. Authentication Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT / FRONTEND LAYER                           │
│                                                                             │
│  ┌───────────────────────────┐                 ┌─────────────────────────┐  │
│  │   Web / Admin BFF Proxy   │                 │   iOS Native Client     │  │
│  │   (HttpOnly Lax Cookies)  │                 │   (Keychain Storage)    │  │
│  └─────────────┬─────────────┘                 └────────────┬────────────┘  │
└────────────────┼────────────────────────────────────────────┼───────────────┘
                 │ Proxy Request                              │ Direct Request
                 │ Header: Authorization: Bearer <JWT>       │ Header: Authorization: Bearer <JWT>
                 └──────────────────────┬─────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            NESTJS API CORE                                  │
│                                                                             │
│                    ┌────────────────────────────────────┐                   │
│                    │    JwtAuthGuard (@Public() check)  │                   │
│                    └─────────────────┬──────────────────┘                   │
│                                      │                                      │
│                    ┌─────────────────▼──────────────────┐                   │
│                    │   AdminGuard (role === 'ADMIN')    │                   │
│                    └────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. JWT Token Specification

| Token Type | Lifespan | Storage Mechanism | Revocation Strategy |
|------------|----------|-------------------|---------------------|
| **Access Token** | 15 minutes | HttpOnly Cookie (Web/Admin) / Memory (iOS) | Expire naturally or rotate |
| **Refresh Token** | 7 days | HttpOnly Cookie (Web/Admin) / Keychain (iOS) | Hashed in Postgres DB (`RefreshToken` table); invalidated on logout or ban |

### Payload Structure

Access tokens are signed using `JWT_SECRET` (minimum 32 entropy characters required):

```json
{
  "sub": "usr_123456789",
  "email": "user@gobid.test",
  "role": "USER",
  "iat": 1754560000,
  "exp": 1754560900
}
```

---

## 3. BFF Cookie & CSRF Mechanics (Web & Admin)

Frontends (`apps/web` and `apps/admin`) authenticate using HttpOnly cookies to prevent XSS token theft.

### Cookie Configuration

- **`access_token`**: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` (in production).
- **`refresh_token`**: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` (in production).

### BFF Proxy Protection (`app/api/[...path]/route.ts`)

1. **Same-Origin CSRF Check**: For mutating HTTP requests (`POST`, `PATCH`, `PUT`, `DELETE`), the proxy validates the `Origin` and `Referer` headers against the application host URL.
2. **Nest Path Allowlist**: The proxy only forwards requests to explicitly allowed API path prefixes (`/admin`, `/requests`, `/conversations`, `/support`, `/uploads`, `/notifications`, `/users`, `/auth/me`).
3. **Single-Shot Token Refresh**: If Nest returns a `401 Unauthorized`, the proxy automatically sends `POST /auth/refresh` using the `refresh_token` cookie, sets new cookies, and retries the original request once.

---

## 4. iOS Native Auth & Keychain

- Native iOS client stores `refreshToken` securely in the iOS Keychain (when "Remember Me" is enabled).
- In-memory `accessToken` attached to `URLRequest` via `Authorization: Bearer <accessToken>`.
- Uses a thread-safe, coalesced `TokenRefresher` task queue so multiple concurrent `401` failures trigger only a single token refresh network request.

---

## 5. HMAC Upload Signing (Private File Storage)

Public uploads (avatars, request photos) are served publicly or proxied directly. Private attachments (messages, support tickets) are secured using **HMAC signatures**.

### Signing Mechanism

1. The API generates a signed URL using `UPLOAD_SIGNING_SECRET`:
   ```
   GET /uploads/private/msg_123.pdf?exp=1754564000&sig=a8f9c7...
   ```
2. `UploadsController` validates the signature HMAC and timestamp `exp` before serving or redirecting to object storage.
3. Access logs automatically redact query string parameters (`exp`, `sig`, `token`) to prevent log leaks.

---

## 6. Security Hardening Measures

- **Banned User Filtering**: Banned users (`isBanned: true`) are blocked globally at `JwtAuthGuard` layer. Their refresh tokens are invalidated immediately upon ban.
- **Log Redaction**: Pino logger redacts `passwords`, `tokens`, `cookies`, `authorization` headers, and signed URL query params.
- **Magic-Byte Upload Inspection**: Files uploaded to `/uploads/*` pass through magic-byte sniffing (`mime-sniff.ts`) to prevent MIME-spoofing attacks.
- **Atomic Rate-Limiting**: Redis Lua script enforces sliding-window rate limits (~100 req/min per IP/user) with in-memory map fallback.
