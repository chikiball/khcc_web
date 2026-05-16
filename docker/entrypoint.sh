#!/bin/sh
set -e

echo "==> Running Drizzle migrations..."
node ./node_modules/drizzle-kit/bin.cjs migrate || {
  echo "Migration failed. Check DATABASE_URL and that the db container is reachable."
  exit 1
}

echo "==> Starting Next.js..."
exec "$@"
