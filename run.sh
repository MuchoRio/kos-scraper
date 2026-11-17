#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ ! -d "node_modules" ]; then
  echo "[KosHunt] Installing npm workspace dependencies..."
  npm install
fi

if [ ! -f "client/dist/index.html" ]; then
  echo "[KosHunt] Building frontend bundle..."
  npm run build
fi

PORT="${PORT:-3001}"
HOST="${HOST:-127.0.0.1}"
echo "[KosHunt] Starting Bento Studio at http://${HOST}:${PORT}"
HOST="$HOST" PORT="$PORT" npm run start

