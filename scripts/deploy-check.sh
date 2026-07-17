#!/usr/bin/env bash
# Pré-validação de deploy — EasyPanel / VPS
# Uso: ./scripts/deploy-check.sh [.env]
set -euo pipefail

ENV_FILE="${1:-.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ERRORS=0

warn() { echo "⚠️  $*"; }
fail() { echo "❌ $*"; ERRORS=$((ERRORS + 1)); }
ok() { echo "✅ $*"; }

echo "=== AguiaAuto — deploy check ==="
echo "Env: ${ENV_FILE}"
echo "Compose: ${COMPOSE_FILE}"
echo

if [[ ! -f "${ENV_FILE}" ]]; then
  fail "Arquivo ${ENV_FILE} não encontrado. Copie .env.production.example → .env"
else
  ok "Arquivo ${ENV_FILE} encontrado"
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  fail "Compose ${COMPOSE_FILE} não encontrado"
else
  ok "Compose ${COMPOSE_FILE} encontrado"
fi

if command -v docker >/dev/null 2>&1; then
  if docker compose -f "${COMPOSE_FILE}" config >/dev/null 2>&1; then
    ok "docker compose config válido"
  else
    fail "docker compose config inválido — verifique variáveis obrigatórias no .env"
  fi
else
  warn "Docker não instalado — pulando validação do compose"
fi

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  set -a && source "${ENV_FILE}" && set +a

  required_vars=(
    POSTGRES_PASSWORD
    JWT_SECRET
    ENCRYPTION_KEY
    SESSION_SECRET
    CORS_ORIGIN
    GATEWAY_SECRET
  )

  for var in "${required_vars[@]}"; do
    val="${!var:-}"
    if [[ -z "${val}" ]]; then
      fail "${var} não definida"
    elif [[ "${val}" == *troque* ]] || [[ "${val}" == *altere* ]]; then
      fail "${var} ainda contém placeholder — troque antes do deploy"
    else
      ok "${var} definida"
    fi
  done

  if [[ "${CORS_ORIGIN:-}" == http://* ]]; then
    warn "CORS_ORIGIN usa HTTP — em produção prefira HTTPS"
  fi

  if [[ "${MULTI_TENANT_ENABLED:-false}" == "true" ]]; then
    ok "MULTI_TENANT_ENABLED=true — modo SaaS multi-tenant"
  else
    ok "MULTI_TENANT_ENABLED=false — modo single-tenant (Águia legado)"
  fi
fi

echo
if [[ "${ERRORS}" -gt 0 ]]; then
  echo "Resultado: ${ERRORS} problema(s) encontrado(s). Corrija antes do deploy."
  exit 1
fi

echo "Resultado: pronto para deploy."
echo "Próximo passo: docs/deploy/easypanel.md"
