#!/bin/sh
set -eu

urlencode() {
  # Encode credentials so passwords with @ ! # $ work in DATABASE_URL
  node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$1"
}

if [ -n "${DB_HOST:-}" ] && [ -n "${DB_USER:-}" ] && [ -n "${DB_PASSWORD:-}" ] && [ -n "${DB_NAME:-}" ]; then
  ENC_USER="$(urlencode "$DB_USER")"
  ENC_PASS="$(urlencode "$DB_PASSWORD")"
  DB_PORT="${DB_PORT:-5432}"
  DB_SSLMODE="${DB_SSLMODE:-disable}"
  export DATABASE_URL="postgresql://${ENC_USER}:${ENC_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=${DB_SSLMODE}"
  echo "DATABASE_URL built from DB_HOST/DB_USER/DB_PASSWORD/DB_NAME"
elif [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: Set DATABASE_URL, or set DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME"
  exit 1
fi

echo "Running database migrations..."
prisma migrate deploy

echo "Starting Steward..."
exec "$@"
