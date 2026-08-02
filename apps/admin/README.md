# Admin Panel

Production-ready Next.js 16 admin dashboard with secure authentication, PostgreSQL via Prisma, and RBAC.

## Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Database | PostgreSQL + Prisma 7 |
| Auth | Session-based (bcrypt + HTTP-only cookies) |
| Validation | Zod + React Hook Form |

## Getting Started

```bash
pnpm install
cp .env.example .env   # set DATABASE_URL
pnpm db:generate
pnpm exec prisma db push
pnpm db:seed
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) — you'll be redirected to sign in.

### Demo credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@admin.com | Admin123!Panel |
| Demo users | *@example.com | Demo1234!Panel |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |

See `.env.example` for a template.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run unit tests |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm exec prisma db push` | Apply schema to database |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:studio` | Open Prisma Studio |

## Features

- **Authentication** — Login, signup, logout, password reset, email verification (dev token logged to console)
- **Route protection** — Proxy middleware redirects unauthenticated users
- **RBAC** — Role-based permissions (Super Admin, Admin, Manager, Editor, User)
- **User management** — CRUD with search, pagination, sorting, CSV export
- **Tasks API** — Full CRUD with authorization
- **Activity logs & audit trail** — Track user actions and data changes
- **Dashboard analytics** — Live metrics from database
- **Notifications API** — Per-user notifications with read/unread state
- **Dark mode** — System/light/dark with theme customizer
- **Global search** — ⌘K command palette

## Project Structure

```
app/
  (auth)/          # Sign in, sign up, forgot password
  (dashboard)/     # Protected admin pages
  api/             # REST API routes
  reset-password/  # Password reset flow
actions/           # Server actions (auth, profile)
lib/
  auth/            # Session, permissions, password hashing
  prisma.ts        # Database client
prisma/
  schema.prisma    # Database schema
scripts/
  seed.ts          # Demo data seeder
config/
  navigation.ts    # Shared sidebar + search nav config
```

## Database

Schema includes: User, Session, Permission, RolePermission, Task, Notification, ActivityLog, AuditLog, and token models for password reset / email verification.

After schema changes:

```bash
pnpm db:generate
pnpm exec prisma db push
```

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/auth/session` | Current user + permissions |
| GET/POST | `/api/users` | List/create users |
| GET/PATCH/DELETE | `/api/users/[id]` | User CRUD |
| GET/POST | `/api/tasks` | List/create tasks |
| PATCH/DELETE | `/api/tasks/[id]` | Update/delete task |
| GET | `/api/dashboard/stats` | Dashboard metrics |
| GET/PATCH | `/api/notifications` | Notifications |
| GET | `/api/activity` | Activity logs |
| GET | `/api/audit` | Audit trail |
| GET | `/api/roles` | Roles & permissions |

All protected routes require a valid session cookie and appropriate RBAC permission.

## Testing

```bash
pnpm test
```

Unit tests cover RBAC permission logic. Extend with integration tests as needed.

## Security

- Passwords hashed with bcrypt (12 rounds)
- HTTP-only, SameSite=Lax session cookies
- Input validation on all API boundaries (Zod)
- RBAC checks on every protected endpoint
- Route-level auth via proxy middleware
- Audit trail for sensitive data changes

## License

Private — see repository owner.
