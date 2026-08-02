#!/bin/sh
set -e

mkdir -p /app/.data/uploads
chown -R hero:hero /app/.data 2>/dev/null || true

if [ "${SKIP_DB_PUSH}" != "true" ]; then
  echo "Applying database schema (prisma db push)..."
  runuser -u hero -- ./node_modules/.bin/prisma db push
fi

if [ "${SEED_ON_START}" = "true" ]; then
  echo "Seeding database..."
  ALLOW_SEED=true runuser -u hero -- env ALLOW_SEED=true ./node_modules/.bin/prisma db seed \
    || ALLOW_SEED=true runuser -u hero -- env ALLOW_SEED=true tsx prisma/seed.ts \
    || echo "Seed skipped or failed (continuing)"
fi

exec runuser -u hero -- "$@"
