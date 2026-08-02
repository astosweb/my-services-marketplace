# syntax=docker/dockerfile:1
#
# Monorepo image for Hero API + Admin Panel.
# Build targets: api | admin
#
# Full stack:
#   docker compose up --build
#
# Individual images:
#   docker build --target api -t hero-api .
#   docker build --target admin -t hero-admin .

ARG NODE_VERSION=24

# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/admin/package.json ./apps/admin/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
FROM deps AS api-build
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
# Prisma generate needs a URL even when not connecting during build
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
RUN pnpm --filter @hero/api build \
  && pnpm --filter @hero/api deploy --prod --legacy /prod/api \
  && cp -R apps/api/dist /prod/api/dist \
  && mkdir -p /prod/api/src \
  && cp -R apps/api/src/generated /prod/api/src/generated \
  && cp -R apps/api/prisma /prod/api/prisma \
  && cp apps/api/prisma.config.ts /prod/api/prisma.config.ts \
  && cp apps/api/prisma/seed.ts /prod/api/prisma/seed.ts

# -----------------------------------------------------------------------------
FROM deps AS admin-build
COPY packages/shared ./packages/shared
COPY apps/admin ./apps/admin
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Build-time placeholder; runtime API_URL is set in compose
ENV API_URL=http://api:3000
RUN pnpm --filter admin-panel build

# -----------------------------------------------------------------------------
FROM base AS api
ENV NODE_ENV=production
ENV PORT=3000
RUN useradd --system --uid 1001 --create-home hero \
  && corepack enable \
  && npm install -g tsx@4
COPY --from=api-build --chown=hero:hero /prod/api /app
COPY docker/entrypoint-api.sh /usr/local/bin/entrypoint-api.sh
RUN chmod +x /usr/local/bin/entrypoint-api.sh \
  && mkdir -p /app/.data/uploads \
  && chown -R hero:hero /app
WORKDIR /app
EXPOSE 3000
ENTRYPOINT ["entrypoint-api.sh"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=3 \
  CMD runuser -u hero -- node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

# -----------------------------------------------------------------------------
FROM base AS admin
ENV NODE_ENV=production
ENV PORT=3001
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
RUN useradd --system --uid 1001 --create-home hero
# Next standalone output preserves monorepo paths under .next/standalone
COPY --from=admin-build --chown=hero:hero /app/apps/admin/.next/standalone ./
COPY --from=admin-build --chown=hero:hero /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=admin-build --chown=hero:hero /app/apps/admin/public ./apps/admin/public
USER hero
WORKDIR /app/apps/admin
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)).then(r=>process.exit([200,307,308].includes(r.status)?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
