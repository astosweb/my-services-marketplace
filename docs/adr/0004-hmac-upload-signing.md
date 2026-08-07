# ADR 0004: HMAC URL Signing for Private Media Uploads

- **Status**: Accepted
- **Date**: 2026-08-05

## Context

Public uploads (user avatars, public request photos) can be served directly over HTTP. However, private uploads (chat message attachments, customer support ticket documents) contain sensitive personal information and must not be accessible via guessable static file URLs.

## Decision

We implement **HMAC URL Signing** using `UPLOAD_SIGNING_SECRET`:

1. When rendering chat messages or support ticket details, NestJS API generates short-lived signed URLs containing expiration timestamp `exp` and HMAC signature `sig`.
2. `UploadsController` validates the signature and expiration timestamp before streaming the file or issuing a signed object storage redirect.
3. Access log filters automatically redact query parameters (`sig`, `exp`, `token`) to prevent signature leakage in Pino log files.

## Consequences

- **Positive**: Complete privacy protection for private user attachments; URL signatures expire automatically.
- **Negative**: Requires non-null `UPLOAD_SIGNING_SECRET` environment variable configuration in production.
