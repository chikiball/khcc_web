#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "=== Burkam Web Deploy ==="

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $REPO_DIR"
  echo "Copy .env.example to .env and fill in DB password, AUTH_SECRET, Google OAuth."
  exit 1
fi

# Ensure the user-uploads bind-mount target exists on the host so docker
# doesn't create it root-owned. Chown to uid:gid 1001:1001 (the nextjs
# user inside the container) so the app can actually write to it.
mkdir -p uploads/avatars
sudo chown -R 1001:1001 uploads 2>/dev/null || chown -R 1001:1001 uploads

echo "--- git pull ---"
git pull origin main

echo "--- docker compose up db (ensure healthy first) ---"
docker compose up -d db

echo "--- waiting for db healthcheck ---"
for i in $(seq 1 20); do
  status="$(docker inspect --format='{{.State.Health.Status}}' burkam-db 2>/dev/null || echo 'unknown')"
  if [ "$status" = "healthy" ]; then
    echo "--- db healthy ---"
    break
  fi
  echo "  attempt $i/20 — db status: $status"
  sleep 3
done

echo "--- syncing db role password with .env ---"
# postgres only honours POSTGRES_PASSWORD on FIRST volume init. Without this
# step, any later change to POSTGRES_PASSWORD in .env would leave the stored
# role password stale and silently break burkam-web auth. Idempotent — runs
# every deploy. Uses psql's :'var' interpolation so the password is properly
# escaped even if it contains quotes or backslashes.
PW=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)
DB_USER=$(grep '^POSTGRES_USER=' .env | cut -d= -f2-)
DB_NAME=$(grep '^POSTGRES_DB=' .env | cut -d= -f2-)
DB_USER=${DB_USER:-burkam}
DB_NAME=${DB_NAME:-burkam}

if [ -z "$PW" ]; then
  echo "ERROR: POSTGRES_PASSWORD is empty in .env — aborting deploy"
  exit 1
fi

docker exec -i burkam-db psql -U "$DB_USER" -d "$DB_NAME" -v ROLEPASS="$PW" >/dev/null <<SQL
ALTER USER "$DB_USER" WITH PASSWORD :'ROLEPASS';
SQL
echo "--- role password in sync ---"

echo "--- docker build ---"
docker compose build burkam-web

echo "--- docker up burkam-web (entrypoint runs migrations before Next.js boots) ---"
docker compose up -d burkam-web

echo "--- waiting for web healthcheck ---"
for i in $(seq 1 20); do
  status="$(docker inspect --format='{{.State.Health.Status}}' burkam-web 2>/dev/null || echo 'unknown')"
  if [ "$status" = "healthy" ]; then
    echo "--- healthy ---"
    break
  fi
  echo "  attempt $i/20 — web status: $status"
  sleep 5
done

docker compose ps
echo "=== Deploy complete ==="
echo "Reload nginx if you changed nginx/burkam.conf:  sudo nginx -s reload"
