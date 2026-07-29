# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://neondb_owner:npg_SqdKyQcD5YU0@ep-dry-frost-a2lasvip-pooler.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
ENV JWT_SECRET="build-time-placeholder-secret-32chars"
RUN pnpm db:generate && pnpm build && pnpm prune --prod

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=development
RUN useradd --system --uid 1001 --create-home hero
COPY --from=build --chown=hero:hero /app/package.json ./
COPY --from=build --chown=hero:hero /app/node_modules ./node_modules
COPY --from=build --chown=hero:hero /app/dist ./dist
COPY --from=build --chown=hero:hero /app/prisma ./prisma
COPY --from=build --chown=hero:hero /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=hero:hero /app/src/generated ./src/generated
RUN mkdir -p /app/.data/uploads && chown -R hero:hero /app
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD runuser -u hero -- node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
