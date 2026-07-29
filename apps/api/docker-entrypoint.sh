#!/bin/sh
set -e

mkdir -p /app/.data/uploads
chown -R hero:hero /app/.data

if [ "${SKIP_DB_PUSH}" != "true" ]; then
  echo "Applying database schema..."
  runuser -u hero -- ./node_modules/.bin/prisma db push --skip-generate
fi

exec runuser -u hero -- "$@"
