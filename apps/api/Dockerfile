# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm build && pnpm prune --prod

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN useradd --system --uid 1001 --create-home gobid
COPY --from=build --chown=gobid:gobid /app/package.json ./
COPY --from=build --chown=gobid:gobid /app/node_modules ./node_modules
COPY --from=build --chown=gobid:gobid /app/dist ./dist
COPY --from=build --chown=gobid:gobid /app/prisma ./prisma
COPY --from=build --chown=gobid:gobid /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=gobid:gobid /app/src/generated ./src/generated
RUN mkdir -p /app/.data/uploads && chown -R gobid:gobid /app
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD runuser -u gobid -- node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
