#!/bin/sh
set -e

mkdir -p /app/.data/uploads
chown -R gobid:gobid /app/.data

if [ "${SKIP_DB_PUSH}" != "true" ]; then
  echo "Applying database schema..."
  runuser -u gobid -- ./node_modules/.bin/prisma db push --accept-data-loss
fi

exec runuser -u gobid -- "$@"
