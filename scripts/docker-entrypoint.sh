#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required"
  exit 1
fi

echo "Running database migrations..."
prisma migrate deploy

echo "Starting Steward..."
exec "$@"
