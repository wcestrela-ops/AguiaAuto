#!/bin/sh
set -eu

export NODE_ENV="${NODE_ENV:-production}"
export PROCESS_ROLE="${PROCESS_ROLE:-api}"
export API_PORT="${API_PORT:-3000}"
export ENABLE_INLINE_POLLERS="${ENABLE_INLINE_POLLERS:-true}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL é obrigatória."
  echo "No EasyPanel: crie um Postgres no mesmo projeto e cole a URL interna."
  echo "Ex.: postgresql://aguia:SENHA@aguia_postgres:5432/aguia"
  exit 1
fi

# Normaliza postgres:// → postgresql://
case "${DATABASE_URL}" in
  postgres://*)
    DATABASE_URL="postgresql://${DATABASE_URL#postgres://}"
    export DATABASE_URL
    echo "[entrypoint] DATABASE_URL normalizada para postgresql://"
    ;;
esac

if [ -z "${JWT_SECRET:-}" ] || [ -z "${ENCRYPTION_KEY:-}" ] || [ -z "${SESSION_SECRET:-}" ]; then
  echo "ERROR: Defina JWT_SECRET, ENCRYPTION_KEY e SESSION_SECRET no Environment do App."
  exit 1
fi

if [ -z "${CORS_ORIGIN:-}" ]; then
  echo "WARN: CORS_ORIGIN vazio — use https://gestao.aguiaon.com (sem barra no final)."
fi

# Garante include do supervisor
if [ ! -f /etc/supervisor/supervisord.conf ]; then
  printf '%s\n' \
    '[supervisord]' \
    'nodaemon=true' \
    'user=root' \
    '[include]' \
    'files = /etc/supervisor/conf.d/*.conf' \
    > /etc/supervisor/supervisord.conf
elif ! grep -q 'files = /etc/supervisor/conf.d' /etc/supervisor/supervisord.conf 2>/dev/null; then
  printf '\n[include]\nfiles = /etc/supervisor/conf.d/*.conf\n' >> /etc/supervisor/supervisord.conf
fi

echo "[entrypoint] Aguardando Postgres..."
i=0
until node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
c.connect()
  .then(async () => { await c.query('SELECT 1'); await c.end(); process.exit(0); })
  .catch((e) => { console.error('[entrypoint] Postgres ainda indisponível:', e.message); process.exit(1); });
" 2>/tmp/pg-wait.err; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "ERROR: Postgres não respondeu em ~60s."
    echo "Confira DATABASE_URL (host = nome do serviço Postgres no EasyPanel)."
    cat /tmp/pg-wait.err 2>/dev/null || true
    exit 1
  fi
  sleep 2
done
echo "[entrypoint] Postgres OK"

echo "AguiaAuto App — iniciando (nginx :80 + api :3000)"
exec "$@"
