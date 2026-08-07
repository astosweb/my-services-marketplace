# ADR 0003: Binary Server RBAC with Client UI Navigation Permissions

- **Status**: Accepted
- **Date**: 2026-08-05

## Context

Designing a complex dynamic database permission system (with arbitrary string grants per user) adds significant ORM query overhead and security complexity on every server request.

## Decision

We separate **server-side security** from **client navigation display**:

1. **Server-Side Enforcement**: NestJS API enforces a strict binary role check (`USER` vs `ADMIN`). All `/admin/*` routes require `user.role === 'ADMIN'` validated by NestJS `AdminGuard`.
2. **Client Navigation Display**: In `apps/admin`, fine-grained permission strings (e.g. `users:read`, `support:write`) defined in `config/navigation.ts` are used exclusively to toggle UI menu links and button visibility for administrative staff sub-roles.

## Consequences

- **Positive**: Blazing fast server security checks without extra database permission joins; zero privilege escalation vulnerability on server API endpoints.
- **Negative**: Staff sub-role limitations are UI-level rather than granular server permissions.
