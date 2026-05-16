#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "=== KHCC Web Deploy ==="

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $REPO_DIR"
  echo "Copy .env.example to .env and fill in the Supabase keys before deploying."
  exit 1
fi

echo "--- git pull ---"
git pull origin main

echo "--- docker build (with NEXT_PUBLIC_* baked in) ---"
docker compose build khcc-web

echo "--- docker up ---"
docker compose up -d khcc-web

echo "--- waiting for healthcheck ---"
for i in $(seq 1 12); do
  status="$(docker inspect --format='{{.State.Health.Status}}' khcc-web 2>/dev/null || echo 'unknown')"
  if [ "$status" = "healthy" ]; then
    echo "--- healthy ---"
    break
  fi
  echo "  attempt $i/12 — status: $status"
  sleep 5
done

docker compose ps
echo "=== Deploy complete ==="
echo "Reload nginx if you changed nginx/khcc.conf:  sudo nginx -s reload"
