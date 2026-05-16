#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "=== KHCC Web Deploy ==="

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $REPO_DIR"
  echo "Copy .env.example to .env and fill in DB password, AUTH_SECRET, Google OAuth."
  exit 1
fi

echo "--- git pull ---"
git pull origin main

echo "--- docker compose up db (ensure healthy first) ---"
docker compose up -d db

echo "--- waiting for db healthcheck ---"
for i in $(seq 1 20); do
  status="$(docker inspect --format='{{.State.Health.Status}}' khcc-db 2>/dev/null || echo 'unknown')"
  if [ "$status" = "healthy" ]; then
    echo "--- db healthy ---"
    break
  fi
  echo "  attempt $i/20 — db status: $status"
  sleep 3
done

echo "--- docker build ---"
docker compose build khcc-web

echo "--- docker up khcc-web (entrypoint runs migrations before Next.js boots) ---"
docker compose up -d khcc-web

echo "--- waiting for web healthcheck ---"
for i in $(seq 1 20); do
  status="$(docker inspect --format='{{.State.Health.Status}}' khcc-web 2>/dev/null || echo 'unknown')"
  if [ "$status" = "healthy" ]; then
    echo "--- healthy ---"
    break
  fi
  echo "  attempt $i/20 — web status: $status"
  sleep 5
done

docker compose ps
echo "=== Deploy complete ==="
echo "Reload nginx if you changed nginx/khcc.conf:  sudo nginx -s reload"
