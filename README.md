# Gobid — Local Services Marketplace

**Gobid** connects neighbors across Estonia with trusted local service providers. Post a request, receive offers, chat, track job progress, and leave reviews — from web, admin, or the native iOS app.

Tagline: *Local help, when you need it.*

---

## Concept

A two-sided marketplace focused on home and local services (plumbing, cleaning, handyman, moving, pet care, and more):

1. **Requester** posts a service request with category, city/location, budget, photos, and schedule.
2. **Providers** browse open requests (list or map), filter by category/city, and submit offers.
3. **Owner** accepts an offer → parties message, track job progress, complete the job, and review each other.
4. **Admins** moderate requests (approve/reject), manage users, offers, reviews, categories, and support tickets.

Supported cities today: Tallinn, Tartu, Pärnu, Narva.

### Core domain flow

```
Request (PENDING_REVIEW → OPEN)
  → Offers (PENDING → ACCEPTED)
  → Job progress (ACCEPTED → ON_THE_WAY → STARTED → PROVIDER_DONE → OWNER_CONFIRMED)
  → Review + COMPLETED
```

Pricing modes: **provider offers** a price, or **owner sets a fixed price**.

---

## Monorepo layout

```
gobid/
├── apps/
│   ├── api/          # NestJS REST API (port 3000)
│   ├── admin/        # Next.js admin dashboard (port 3001)
│   └── web/          # Next.js public marketplace (port 3002)
├── packages/
│   └── shared/       # Shared Zod schemas, types, permissions (@monorepo/shared)
├── ios-app/          # Native SwiftUI client (Gobid)
├── docker/           # Docker helpers
├── docker-compose.yml
└── Dockerfile
```

Package manager: **pnpm** (workspaces). Database schema lives in `apps/api/prisma/schema.prisma` and is shared by API and admin via Prisma generate.

| App | Package name | Role |
|-----|--------------|------|
| API | `@gobid/api` | Auth, marketplace, messaging, uploads, admin, support |
| Admin | `admin-panel` | Internal ops dashboard (RBAC) |
| Web | `web` | Public landing + marketplace UI |
| Shared | `@monorepo/shared` | API contracts, auth/marketplace/support Zod types |
| iOS | `ios-app/GobidApp` | Native Explore / requests / auth client |

---

## Stack

| Layer | Technology |
|-------|------------|
| API | Node 22+, NestJS 11, TypeScript, Passport JWT, Swagger |
| DB | PostgreSQL 18, Prisma 7 |
| Cache / jobs | Redis 8, BullMQ (token cleanup when Redis is set) |
| Admin / Web | Next.js 16 (App Router), React 19, Tailwind CSS v4, TanStack Query |
| Validation | Zod (+ class-validator on Nest DTOs) |
| Storage | Local disk (dev) or DigitalOcean Spaces (S3) |
| Email | Resend (password reset) |
| Push | APNs (optional) |
| iOS | SwiftUI, MapKit |

---

## Quick start

### Prerequisites

- Node.js ≥ 22, pnpm ≥ 10
- Docker (PostgreSQL + Redis)

### Local development

```bash
# From repo root
cp .env.docker.example .env          # optional compose secrets
cp apps/api/.env.example apps/api/.env

pnpm install

# Start Postgres (5433) + Redis (6380)
pnpm --filter @gobid/api docker:up

# Schema + seed
pnpm --filter @gobid/api db:generate
pnpm --filter @gobid/api db:push
pnpm --filter @gobid/api db:seed

# Run apps (separate terminals)
pnpm dev:api      # http://localhost:3000  — Swagger: /docs
pnpm dev:admin    # http://localhost:3001
pnpm dev:web      # http://localhost:3002
```

Full stack via Docker Compose:

```bash
cp .env.docker.example .env   # fill JWT_SECRET, Spaces, Resend, etc.
pnpm docker:up
```

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/docs |
| Admin | http://localhost:3001 |
| Web | http://localhost:3002 |

After seeding, typical admin demo login is documented in [`apps/admin/README.md`](apps/admin/README.md).

---

## Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Web (3002) │  │ Admin (3001)│  │  iOS app    │
│  Next.js    │  │  Next.js    │  │  SwiftUI    │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │ BFF cookies    │ BFF cookies    │ Bearer JWT
       │ /api/* proxy   │ /api/* proxy   │
       └────────┬───────┴────────────────┘
                ▼
        ┌───────────────┐
        │  NestJS API   │
        │  :3000        │
        └───────┬───────┘
                │
     ┌──────────┼──────────┐
     ▼          ▼          ▼
 PostgreSQL   Redis    Spaces/local
                        uploads
```

- **Web/Admin** keep JWT in HTTP-only cookies and proxy Nest routes through `app/api/[...path]` plus dedicated auth routes (`login`, `refresh`, `logout`, …).
- **iOS** talks to the API directly with Bearer tokens; refresh is coalesced on `401`.
- Frontends must not query Prisma for marketplace data — use the Nest API and `@monorepo/shared` types.

---

## API overview

Base URL: `http://localhost:3000`

Success responses use a `{ "data": ... }` envelope. Lists add `meta` (pagination). Errors:

```json
{
  "error": {
    "message": "Not found",
    "code": "NOT_FOUND",
    "requestId": "..."
  }
}
```

Auth: `Authorization: Bearer <accessToken>` (except public auth/health/browse endpoints). Rate limit: ~100 req/min (Throttler). Request IDs via middleware.

Interactive docs: `/docs` (disabled in production unless `ENABLE_SWAGGER=true`).

### Controllers (NestJS modules)

| Module | Controller | Path prefix | Responsibility |
|--------|------------|-------------|----------------|
| Health | `HealthController` | `/health` | Liveness / readiness |
| Auth | `AuthController` | `/auth` | Register, login, refresh, profile, password reset |
| Categories | `CategoriesController` | `/categories` | Public category catalog |
| Requests | `RequestsController` | `/requests` | Marketplace requests, offers, progress, reviews, per-request chat |
| Conversations | `ConversationsController` | `/conversations` | Inbox, messages, archive/pin/read |
| Notifications | `NotificationsController` | `/notifications` | In-app notifications + category preferences |
| Users | `UsersController` | `/users` | Public profiles, reviews, profile updates |
| Devices | `DevicesController` | `/devices` | Push device token register/remove |
| Uploads | `UploadsController` | `/uploads` | Photos, avatars, message/support attachments |
| Support | `SupportController` | `/support` | User-facing help-desk tickets |
| Support | `AdminSupportController` | `/admin/support` | Agent ticket queue, notes, canned replies |
| Admin | `AdminController` | `/admin` | Dashboard, users, moderation, system status |

Supporting modules (no HTTP surface or shared): `PrismaModule`, `EmailModule`, `PushModule`, `JobsModule` (BullMQ), `CommonModule` (guards, filters, decorators).

---

## HTTP API reference

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Liveness |
| GET | `/health/ready` | — | Readiness (DB, etc.) |

### Authentication — `AuthController`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Access + refresh tokens |
| POST | `/auth/refresh` | — | Rotate tokens |
| POST | `/auth/logout` | JWT | Invalidate refresh |
| POST | `/auth/forgot-password` | — | Start reset (email / dev token) |
| POST | `/auth/reset-password` | — | Complete reset |
| GET | `/auth/me` | JWT | Current user |
| GET | `/auth/me/stats` | JWT | Profile stats |
| PATCH | `/auth/me` | JWT | Update profile |
| DELETE | `/auth/me` | JWT | Delete account |

### Marketplace — `RequestsController` / `CategoriesController`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/categories` | — | All categories |
| GET | `/requests` | optional | Browse open requests (filters, pagination) |
| GET | `/requests/mine` | JWT | Current user’s requests |
| POST | `/requests` | JWT | Create request (`PENDING_REVIEW`) |
| GET | `/requests/:id` | optional | Request detail |
| PATCH | `/requests/:id` | JWT | Update own request |
| POST | `/requests/:id/views` | — | Increment view count |
| GET/POST | `/requests/:id/offers` | JWT | List / submit offers |
| PATCH | `/requests/:id/offers/:offerId` | JWT | Accept / decline / withdraw |
| PATCH | `/requests/:id/status` | JWT | Cancel / complete lifecycle |
| PATCH | `/requests/:id/progress` | JWT | Job progress steps |
| POST | `/requests/:id/reviews` | JWT | Leave a review |
| GET/POST | `/requests/:id/conversation` | JWT | Get or start request conversation |
| POST | `/requests/:id/messages` | JWT | Send message on request thread |

### Messaging — `ConversationsController`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/conversations` | Inbox |
| PATCH | `/conversations/:id/archive` | Archive |
| PATCH | `/conversations/:id/pin` | Pin |
| GET/POST | `/conversations/:id/messages` | List / send |
| POST | `/conversations/:id/read` | Mark read |

### Notifications — `NotificationsController`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | List |
| PATCH | `/notifications/:id` | Mark one read |
| POST | `/notifications/read-all` | Mark all read |
| GET/PUT | `/notifications/preferences` | Category alert preferences |

### Users, devices, uploads

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/:id` | Public profile |
| GET | `/users/:id/reviews` | Reviews received |
| PATCH | `/users/:id` | Update (authorized) |
| POST | `/devices` | Register push token |
| DELETE | `/devices/:token` | Unregister |
| POST | `/uploads/request-photos` | Multipart request photos (public) |
| POST | `/uploads/avatars` | Avatar upload (public) |
| POST | `/uploads/message-attachments` | Private attachments |
| POST | `/uploads/support-attachments` | Support ticket files |
| GET | `/uploads/*` | Serve / proxy stored objects |

### Support — user (`SupportController`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/support/tickets` | Open ticket |
| GET | `/support/tickets` | My tickets |
| GET | `/support/tickets/:id` | Ticket detail |
| POST | `/support/tickets/:id/messages` | Reply |
| POST | `/support/tickets/:id/read` | Mark read |
| POST | `/support/tickets/:id/reopen` | Reopen |
| POST/GET | `/support/tickets/:id/typing` | Typing indicator |

### Support — admin (`AdminSupportController`)

Prefix: `/admin/support` (admin JWT). Includes ticket list/export, bulk actions, assign/status/priority, internal notes, merge, canned responses, stats, typing.

### Admin ops — `AdminController`

Prefix: `/admin` (admin role). Highlights:

| Area | Endpoints |
|------|-----------|
| Dashboard | `GET /admin/dashboard/stats` |
| Users | list/export/CRUD, bulk, sessions & devices revoke |
| Requests | list/create/patch/delete, `approve` / `reject` |
| Offers / reviews | list, patch/delete |
| Categories | `GET /admin/categories` |
| Conversations | list + messages (moderation view) |
| RBAC metadata | `GET /admin/roles`, `/admin/permissions` |
| System | `GET /admin/system/status` |

---

## Database (Prisma)

Single schema: `apps/api/prisma/schema.prisma`.

Important models: `User`, `Category`, `ServiceRequest`, `Offer`, `Conversation` / `Message`, `Notification`, `Review`, `DeviceToken`, `RefreshToken`, support ticket graph (`SupportTicket`, messages, notes, activities, canned responses), `AuditLog`.

Apply schema changes with:

```bash
pnpm --filter @gobid/api db:generate
pnpm --filter @gobid/api db:push
```

Prefer `prisma db push` over migrate in this project.

---

## Apps in more detail

### API (`apps/api`)

See [`apps/api/README.md`](apps/api/README.md) for env vars, production checklist, and ops notes.

Guards: JWT auth, admin role checks, global validation pipe + exception filter. Structured JSON logs (Pino) with secrets redacted.

### Web (`apps/web`)

Public marketplace: landing, explore/search, categories, request detail/create, providers, auth, dashboard, messages, notifications, favorites, profile/settings. Proxies Nest via Next route handlers; session cookies for browser auth.

### Admin (`apps/admin`)

Ops UI: dashboard, users, requests, offers, reviews, categories, conversations, support desk, roles, system status. RBAC permissions gate nav and API usage. Details: [`apps/admin/README.md`](apps/admin/README.md).

### Shared (`packages/shared`)

Exports typed contracts used by web/admin clients: `api`, `auth`, `users`, `dashboard`, `marketplace`, `public`, `support`, `permissions`. Keep request/response shapes in sync with Nest serializers here.

### iOS (`ios-app`)

SwiftUI client (Explore list/map, request detail, auth, Keychain refresh). See [`ios-app/README.md`](ios-app/README.md).

---

## Root scripts

| Script | Description |
|--------|-------------|
| `pnpm dev:api` / `dev:admin` / `dev:web` | Run one app in watch mode |
| `pnpm build:api` / `build:admin` / `build:web` | Production builds |
| `pnpm typecheck` | Recursive TypeScript check |
| `pnpm docker:up` / `docker:down` / `docker:logs` | Compose lifecycle |

---

## Environment

| Variable | Where | Notes |
|----------|-------|--------|
| `DATABASE_URL` | API (admin generate) | Postgres connection |
| `JWT_SECRET` | API | ≥ 32 chars |
| `REDIS_URL` | API | Rate limits + BullMQ |
| `CORS_ORIGIN` | API | Explicit allowlist in production |
| `UPLOAD_STORAGE` / Spaces `SPACES_*` | API | Local vs Spaces |
| `RESEND_API_KEY` / `EMAIL_FROM` | API | Password reset mail |
| `API_URL` | Web / Admin | Nest base URL for BFF |
| `NEXT_PUBLIC_SITE_URL` | Web | Canonical site URL |

Templates: `apps/api/.env.example`, `.env.docker.example`.

---

## Security notes

- Passwords hashed (bcrypt); refresh tokens stored hashed and rotatable.
- Helmet, CORS allowlist, body size limits, throttling.
- Web/Admin BFF proxies enforce same-origin checks on mutating requests and allowlisted Nest path prefixes.
- Message/support attachments are private; request photos and avatars are public (or proxied).
- Admin API requires `ADMIN` role; admin UI permission strings gate navigation only (binary RBAC).
- Never commit `.env` or Spaces/APNs secrets.

---

## Deployment

See [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) for backups, health checks, and schema/ops notes.

## Further reading

- [`apps/api/README.md`](apps/api/README.md) — API setup & env
- [`apps/admin/README.md`](apps/admin/README.md) — Admin panel
- [`ios-app/README.md`](ios-app/README.md) — iOS client
- [`AGENTS.md`](./AGENTS.md) — agent / contributor conventions
- [`PROJECT_AUDIT_REPORT.md`](./PROJECT_AUDIT_REPORT.md) — architecture audit
- Swagger UI — `http://localhost:3000/docs` when enabled

Private repository — see repository owner for license and access.
