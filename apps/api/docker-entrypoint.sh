#!/bin/sh
set -e

mkdir -p /app/.data/uploads
chown -R hero:hero /app/.data

exec runuser -u hero -- "$@"
