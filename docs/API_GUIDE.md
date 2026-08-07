# REST API Reference & Conventions

## Base URLs & Swagger Interactive Docs

- **Local Development**: `http://localhost:3000`
- **Swagger / OpenAPI UI**: `http://localhost:3000/docs` (OpenAPI JSON: `/docs/openapi.json`)
- **Production**: `https://api.gobid.ee` (Swagger disabled in production unless `ENABLE_SWAGGER=true`)

---

## 1. Response Envelopes

### Success Envelope

All single-resource and multi-resource responses wrap payload data under a top-level `"data"` key. List endpoints attach pagination metadata under `"meta"`.

```json
{
  "data": [
    {
      "id": "req_clx123",
      "title": "Fix leaking kitchen sink",
      "status": "OPEN",
      "budget": 75,
      "pricingType": "FIXED"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

### Error Envelope

All HTTP errors follow a uniform JSON structure produced by NestJS `AllExceptionsFilter`:

```json
{
  "error": {
    "message": "Offer has already been accepted or declined",
    "code": "INVALID_STATUS_TRANSITION",
    "requestId": "req_987654321"
  }
}
```

---

## 2. Standard Error Codes & Status Mapping

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| `400 Bad Request` | `BAD_REQUEST` / `VALIDATION_ERROR` | DTO validation failure or invalid payload |
| `401 Unauthorized` | `UNAUTHORIZED` | Missing, expired, or invalid JWT bearer token |
| `403 Forbidden` | `FORBIDDEN` | Resource ownership check failed or missing `ADMIN` role |
| `404 Not Found` | `NOT_FOUND` | Requested entity ID does not exist |
| `409 Conflict` | `CONFLICT` | Unique constraint violation (e.g. email already exists, duplicate offer) |
| `429 Too Many Requests` | `TOO_MANY_REQUESTS` | Rate limit threshold exceeded |
| `500 Internal Error` | `INTERNAL_SERVER_ERROR` | Unhandled server error (stack trace redacted in production) |

---

## 3. Module & Controller Directory

### Authentication (`/auth`)
- `POST /auth/register` — Create requester/provider account
- `POST /auth/login` — Authenticate and issue JWT access + refresh tokens
- `POST /auth/refresh` — Rotate access and refresh tokens
- `POST /auth/logout` — Invalidate refresh token session
- `POST /auth/forgot-password` — Initiate password reset email/token
- `POST /auth/reset-password` — Complete password reset with token
- `GET /auth/me` — Retrieve logged-in user profile
- `PATCH /auth/me` — Update logged-in user profile
- `DELETE /auth/me` — Request account deletion

### Marketplace & Categories (`/requests`, `/categories`)
- `GET /categories` — Public service categories catalog
- `GET /requests` — Browse open requests (filterable by `category`, `city`, `q`, paginated)
- `GET /requests/mine` — List user's created requests
- `POST /requests` — Create service request (starts `PENDING_REVIEW` or `OPEN`)
- `GET /requests/:id` — Detail view of a service request
- `PATCH /requests/:id` — Update own service request details
- `POST /requests/:id/views` — Increment public view counter
- `GET /requests/:id/offers` — List offers submitted on a request
- `POST /requests/:id/offers` — Submit a bid/offer on a request
- `PATCH /requests/:id/offers/:offerId` — Accept, decline, or withdraw an offer
- `PATCH /requests/:id/status` — Change request status (`CANCELLED`, `COMPLETED`)
- `PATCH /requests/:id/progress` — Advance job progress steps (`ON_THE_WAY`, `STARTED`, `PROVIDER_DONE`, `OWNER_CONFIRMED`)
- `POST /requests/:id/reviews` — Submit job review after completion

### Messaging (`/conversations`)
- `GET /conversations` — User inbox (paginated, sort by pinned/recent)
- `PATCH /conversations/:id/archive` — Toggle conversation archive state
- `PATCH /conversations/:id/pin` — Toggle conversation pin state
- `GET /conversations/:id/messages` — Fetch message history
- `POST /conversations/:id/messages` — Send direct message
- `POST /conversations/:id/read` — Mark conversation messages read

### Notifications (`/notifications`)
- `GET /notifications` — Fetch user in-app notifications list
- `PATCH /notifications/:id` — Mark single notification read
- `POST /notifications/read-all` — Mark all notifications read

### Support Desk (`/support`)
- `POST /support/tickets` — Open user support ticket
- `GET /support/tickets` — Fetch user's support tickets
- `GET /support/tickets/:id` — Ticket detail with messages & activities
- `POST /support/tickets/:id/messages` — User reply to support ticket

### Admin Operations (`/admin`)
- `GET /admin/dashboard/stats` — Metrics overview
- `GET /admin/users` — User management (list, export, ban/unban, delete)
- `GET /admin/requests` — Request moderation (approve, reject, delete)
- `GET /admin/support/tickets` — Admin support desk queue, assignment, internal notes, canned replies
- `GET /admin/system/status` — Database & Redis status monitor
