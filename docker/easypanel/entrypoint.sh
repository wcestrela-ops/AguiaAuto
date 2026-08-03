#!/bin/sh
set -eu

export NODE_ENV="${NODE_ENV:-production}"
export PROCESS_ROLE="${PROCESS_ROLE:-api}"
export API_PORT="${API_PORT:-3000}"
export ENABLE_INLINE_POLLERS="${ENABLE_INLINE_POLLERS:-true}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL é obrigatória."
  echo "No EasyPanel: crie um serviço Postgres no mesmo projeto e cole a URL de conexão."
  exit 1
fi

if [ -z "${JWT_SECRET:-}" ] || [ -z "${ENCRYPTION_KEY:-}" ] || [ -z "${SESSION_SECRET:-}" ]; then
  echo "ERROR: Defina JWT_SECRET, ENCRYPTION_KEY e SESSION_SECRET no Environment do App."
  exit 1
fi

if [ -z "${CORS_ORIGIN:-}" ]; then
  echo "WARN: CORS_ORIGIN vazio — use https://gestao.aguiaon.com (sem barra no final)."
fi

# Garante includes do supervisor
if [ ! -f /etc/supervisor/supervisord.conf ]; then
  printf '%s\n' \
    '[supervisord]' \
    'nodaemon=true' \
    '[include]' \
    'files = /etc/supervisor/conf.d/*.conf' \
    > /etc/supervisor/supervisord.conf
elif ! grep -q 'files = /etc/supervisor/conf.d' /etc/supervisor/supervisord.conf 2>/dev/null; then
  printf '\n[include]\nfiles = /etc/supervisor/conf.d/*.conf\n' >> /etc/supervisor/supervisord.conf
fi

echo "AguiaAuto App — iniciando (nginx :80 + api :3000)"
exec "$@"
