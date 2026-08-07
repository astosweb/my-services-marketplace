# ADR 0002: Push-Based Prisma Schema Workflow (`prisma db push`)

- **Status**: Accepted
- **Date**: 2026-08-05

## Context

During fast iteration and active feature development of the Gobid marketplace, creating and maintaining granular SQL migration scripts for every minor schema field change creates developer friction and migration conflicts.

## Decision

We standardize on **`prisma db push`** (via `pnpm --filter @gobid/api db:push`) for updating the database schema in development and staging environments.

## Consequences

- **Positive**: Rapid schema iteration without managing linear migration files; instant schema synchronization across developer machines.
- **Negative**: For production databases, schema changes must be reviewed carefully and backed up (`pg_dump` or managed DB snapshots) prior to executing `db push` to prevent unintended data loss.
