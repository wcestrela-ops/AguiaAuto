#!/bin/sh
# Sobe a API com logs claros (EasyPanel App)
set -eu
cd /app/services/api

# EasyPanel injeta PORT=80 (porta do App). A API deve ficar na 3000 (nginx faz proxy).
export API_PORT=3000
export PROCESS_ROLE="${PROCESS_ROLE:-api}"
export ENABLE_INLINE_POLLERS="${ENABLE_INLINE_POLLERS:-true}"
export NODE_ENV="${NODE_ENV:-production}"

echo "[api] iniciando node src/server.js (API_PORT=${API_PORT})"
echo "[api] DATABASE_URL host=$(echo "${DATABASE_URL:-}" | sed -E 's|.*@([^/:]+).*|\1|')"

# Falhas de require aparecem no log do EasyPanel
node -e "require('pg'); require('express');" || {
  echo "[api] ERRO: dependências Node ausentes (pg/express). Rebuild a imagem."
  exit 1
}

exec node src/server.js
