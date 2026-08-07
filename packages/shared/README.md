# Shared Contracts (`packages/shared`)

Shared Zod schemas, TypeScript types, and permission constants (`@monorepo/shared`).

## Modules Exported

- `api`: Common API envelope types and pagination interfaces (`PaginatedResponse`, `ApiError`).
- `auth`: Authentication DTOs, login/register/reset schemas.
- `marketplace`: Service request, offer, progress, and review schemas.
- `support`: Support ticket and messaging schemas.
- `users`: Profile update and public user response schemas.
- `dashboard`: Admin dashboard metrics types.
- `permissions`: Navigation permission string definitions.

## Usage

```typescript
import { createServiceRequestSchema, type ServiceRequestDto } from "@monorepo/shared";
```
