#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
WEB_DIR="$ROOT_DIR/apps/web"
ENV_FILE="$BACKEND_DIR/.env"

command -v node >/dev/null 2>&1 || { echo "[deploy] Node.js 20+ is required"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "[deploy] npm is required"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "[deploy] curl is required"; exit 1; }

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if (( NODE_MAJOR < 22 )); then
  echo "[deploy] Node.js 22+ is required; current version: $(node -v)"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  JWT_SECRET_VALUE="$(node -e "process.stdout.write(require('crypto').randomBytes(64).toString('hex'))")"
  ADMIN_PASSWORD_VALUE="${ADMIN_PASSWORD:-$(node -e "process.stdout.write(require('crypto').randomBytes(12).toString('base64url'))")}"
  cat > "$ENV_FILE" <<EOF
PORT=3001
BACKEND_HOST=127.0.0.1
NODE_ENV=production
JWT_SECRET=$JWT_SECRET_VALUE
JWT_EXPIRES_IN=7d
DB_PATH=./data/blog.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600
MAX_FONT_FILE_SIZE=268435456
CORS_ORIGIN=http://127.0.0.1:3002
ADMIN_PASSWORD=$ADMIN_PASSWORD_VALUE
BANGUMI_API_BASE=https://bangumi.lol
BANGUMI_PAGE_BASE=https://bangumi.lol
EOF
  chmod 600 "$ENV_FILE"
  echo "[deploy] created backend/.env"
  echo "[deploy] initial admin: admin / $ADMIN_PASSWORD_VALUE"
  echo "[deploy] save this password now; it will not be printed on later deployments"
fi

if [[ "${1:-}" == "--pull" ]]; then
  echo "[deploy] pulling latest source"
  git -C "$ROOT_DIR" pull --ff-only origin main
fi

mkdir -p "$ROOT_DIR/logs" "$BACKEND_DIR/data" "$BACKEND_DIR/uploads" "$BACKEND_DIR/backups"

echo "[deploy] installing backend dependencies"
npm ci --prefix "$BACKEND_DIR"

echo "[deploy] installing Next frontend dependencies"
npm ci --prefix "$WEB_DIR"

echo "[deploy] building backend"
npm run build --prefix "$BACKEND_DIR"

echo "[deploy] building Next frontend"
API_BASE_INTERNAL="http://127.0.0.1:3001" npm run build --prefix "$WEB_DIR"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[deploy] installing PM2"
  npm install --global pm2
fi

cd "$ROOT_DIR"
# Remove the old Astro PM2 process if this server still has one from a previous deployment.
if pm2 describe boke-frontend >/dev/null 2>&1; then
  echo "[deploy] removing legacy Astro process"
  pm2 delete boke-frontend
fi
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

for attempt in {1..20}; do
  if curl --fail --silent http://127.0.0.1:3001/api/health >/dev/null \
    && curl --fail --silent http://127.0.0.1:3002/api/health >/dev/null \
    && curl --fail --silent http://127.0.0.1:3002/manga >/dev/null; then
    echo "[deploy] success: Next frontend + API are healthy"
    exit 0
  fi
  sleep 1
done

echo "[deploy] services started but health check failed"
pm2 status
pm2 logs --lines 40 --nostream
exit 1
