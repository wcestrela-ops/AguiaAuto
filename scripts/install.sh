#!/usr/bin/env bash
# Instalador AguiaAuto — gera .env, valida e sobe docker-compose.prod.yml
#
# Uso interativo:
#   ./scripts/install.sh
#
# Uso não interativo:
#   ./scripts/install.sh \
#     --domain https://app.seudominio.com \
#     --admin-email admin@empresa.com \
#     --admin-password 'SenhaForte123!' \
#     --yes
#
# Opções:
#   --domain URL              CORS_ORIGIN / URL pública (https://...)
#   --admin-email EMAIL       ADMIN_BOOTSTRAP_EMAIL
#   --admin-password SENHA    ADMIN_BOOTSTRAP_PASSWORD (mín. 10 chars)
#   --postgres-password SENHA POSTGRES_PASSWORD
#   --multi-tenant true|false MULTI_TENANT_ENABLED (default: false)
#   --env-file PATH           caminho do .env (default: .env)
#   --compose-file PATH       compose de produção (default: docker-compose.prod.yml)
#   --skip-up                 só gera .env + valida (não sobe containers)
#   --no-build                docker compose up -d (sem --build)
#   --yes / -y                não pergunta confirmação
#   --dry-run                 gera .env.install.tmp e não sobe nada
#   --help                    esta ajuda
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

ENV_FILE="${ROOT_DIR}/.env"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.prod.yml"
TEMPLATE="${ROOT_DIR}/.env.production.example"
DEPLOY_CHECK="${ROOT_DIR}/scripts/deploy-check.sh"

DOMAIN=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
POSTGRES_PASSWORD=""
MULTI_TENANT="false"
SKIP_UP=0
NO_BUILD=0
ASSUME_YES=0
DRY_RUN=0
HEALTH_TIMEOUT=180

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}==>${NC} $*"; }
ok() { echo -e "${GREEN}✔${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err() { echo -e "${RED}✖${NC} $*" >&2; }

usage() {
  sed -n '2,28p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --admin-email) ADMIN_EMAIL="${2:-}"; shift 2 ;;
    --admin-password) ADMIN_PASSWORD="${2:-}"; shift 2 ;;
    --postgres-password) POSTGRES_PASSWORD="${2:-}"; shift 2 ;;
    --multi-tenant) MULTI_TENANT="${2:-false}"; shift 2 ;;
    --env-file) ENV_FILE="${2:-}"; shift 2 ;;
    --compose-file) COMPOSE_FILE="${2:-}"; shift 2 ;;
    --skip-up) SKIP_UP=1; shift ;;
    --no-build) NO_BUILD=1; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --dry-run) DRY_RUN=1; SKIP_UP=1; shift ;;
    --help|-h) usage ;;
    *) err "Opção desconhecida: $1"; usage ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Comando obrigatório não encontrado: $1"
    exit 1
  fi
}

rand_hex() {
  local bytes="${1:-32}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "${bytes}"
  else
    head -c "${bytes}" /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

prompt() {
  local label="$1"
  local default="${2:-}"
  local secret="${3:-0}"
  local value=""
  if [[ -n "${default}" ]]; then
    if [[ "${secret}" == "1" ]]; then
      read -r -s -p "${label} [oculto]: " value
      echo
    else
      read -r -p "${label} [${default}]: " value
    fi
    echo "${value:-$default}"
  else
    if [[ "${secret}" == "1" ]]; then
      read -r -s -p "${label}: " value
      echo
    else
      read -r -p "${label}: " value
    fi
    echo "${value}"
  fi
}

normalize_domain() {
  local url="$1"
  url="${url%%/}"
  if [[ "${url}" != http://* && "${url}" != https://* ]]; then
    url="https://${url}"
  fi
  echo "${url}"
}

validate_email() {
  [[ "$1" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]
}

check_prereqs() {
  log "Verificando pré-requisitos..."
  require_cmd bash
  if [[ ! -f "${TEMPLATE}" ]]; then
    err "Template não encontrado: ${TEMPLATE}"
    exit 1
  fi
  if [[ ! -f "${COMPOSE_FILE}" ]]; then
    err "Compose não encontrado: ${COMPOSE_FILE}"
    exit 1
  fi
  if [[ ! -x "${DEPLOY_CHECK}" ]]; then
    chmod +x "${DEPLOY_CHECK}" 2>/dev/null || true
  fi

  if [[ "${SKIP_UP}" -eq 0 && "${DRY_RUN}" -eq 0 ]]; then
    require_cmd docker
    if ! docker compose version >/dev/null 2>&1; then
      err "Docker Compose plugin não disponível (docker compose)"
      exit 1
    fi
    ok "Docker + Compose OK"
  else
    if command -v docker >/dev/null 2>&1; then
      ok "Docker disponível"
    else
      warn "Docker não verificado (--skip-up/--dry-run)"
    fi
  fi
}

collect_inputs() {
  log "Configuração da instalação"
  echo

  if [[ -z "${DOMAIN}" ]]; then
    DOMAIN="$(prompt "Domínio público (ex.: https://app.suaempresa.com.br)" "https://app.localhost")"
  fi
  DOMAIN="$(normalize_domain "${DOMAIN}")"

  if [[ -z "${ADMIN_EMAIL}" ]]; then
    ADMIN_EMAIL="$(prompt "E-mail do superadmin" "admin@suaempresa.com.br")"
  fi
  if ! validate_email "${ADMIN_EMAIL}"; then
    err "E-mail inválido: ${ADMIN_EMAIL}"
    exit 1
  fi

  if [[ -z "${ADMIN_PASSWORD}" ]]; then
    if [[ -t 0 ]]; then
      ADMIN_PASSWORD="$(prompt "Senha do superadmin (mín. 10 caracteres)" "" 1)"
      local confirm
      confirm="$(prompt "Confirme a senha" "" 1)"
      if [[ "${ADMIN_PASSWORD}" != "${confirm}" ]]; then
        err "Senhas não coincidem"
        exit 1
      fi
    else
      err "ADMIN_PASSWORD obrigatória em modo não interativo (--admin-password)"
      exit 1
    fi
  fi
  if [[ "${#ADMIN_PASSWORD}" -lt 10 ]]; then
    err "Senha do admin deve ter no mínimo 10 caracteres"
    exit 1
  fi

  if [[ -z "${POSTGRES_PASSWORD}" ]]; then
    if [[ "${ASSUME_YES}" -eq 1 ]]; then
      POSTGRES_PASSWORD="$(rand_hex 24)"
    else
      local pg
      pg="$(prompt "Senha do Postgres (Enter = gerar automática)" "")"
      POSTGRES_PASSWORD="${pg:-$(rand_hex 24)}"
    fi
  fi

  if [[ "${ASSUME_YES}" -eq 0 && -t 0 ]]; then
    local mt
    mt="$(prompt "Ativar multi-tenant SaaS? (true/false)" "${MULTI_TENANT}")"
    MULTI_TENANT="${mt}"
  fi
  if [[ "${MULTI_TENANT}" != "true" ]]; then
    MULTI_TENANT="false"
  fi
}

write_env() {
  local target="$1"
  local jwt enc session gateway

  jwt="$(rand_hex 32)"
  enc="$(rand_hex 32)"
  session="$(rand_hex 32)"
  gateway="$(rand_hex 24)"

  log "Gerando ${target}..."

  # shellcheck disable=SC2016
  awk -v domain="${DOMAIN}" \
      -v admin_email="${ADMIN_EMAIL}" \
      -v admin_password="${ADMIN_PASSWORD}" \
      -v pg_password="${POSTGRES_PASSWORD}" \
      -v jwt="${jwt}" \
      -v enc="${enc}" \
      -v session="${session}" \
      -v gateway="${gateway}" \
      -v multi="${MULTI_TENANT}" '
    BEGIN { done_db_url = 0 }
    /^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" pg_password; next }
    /^DATABASE_URL=/ {
      print "DATABASE_URL=postgresql://aguia:" pg_password "@postgres:5432/aguia"
      done_db_url = 1
      next
    }
    /^JWT_SECRET=/ { print "JWT_SECRET=" jwt; next }
    /^ENCRYPTION_KEY=/ { print "ENCRYPTION_KEY=" enc; next }
    /^SESSION_SECRET=/ { print "SESSION_SECRET=" session; next }
    /^ADMIN_BOOTSTRAP_EMAIL=/ { print "ADMIN_BOOTSTRAP_EMAIL=" admin_email; next }
    /^ADMIN_BOOTSTRAP_PASSWORD=/ { print "ADMIN_BOOTSTRAP_PASSWORD=" admin_password; next }
    /^CORS_ORIGIN=/ { print "CORS_ORIGIN=" domain; next }
    /^GATEWAY_SECRET=/ { print "GATEWAY_SECRET=" gateway; next }
    /^MULTI_TENANT_ENABLED=/ { print "MULTI_TENANT_ENABLED=" multi; next }
    { print }
  ' "${TEMPLATE}" > "${target}.tmp"

  # Garantir DATABASE_URL se o template mudar
  if ! grep -q '^DATABASE_URL=' "${target}.tmp"; then
    echo "DATABASE_URL=postgresql://aguia:${POSTGRES_PASSWORD}@postgres:5432/aguia" >> "${target}.tmp"
  fi

  mv "${target}.tmp" "${target}"
  chmod 600 "${target}" 2>/dev/null || true
  ok "Arquivo gerado: ${target}"
}

confirm_install() {
  echo
  log "Resumo"
  echo "  Domínio:       ${DOMAIN}"
  echo "  Admin e-mail:  ${ADMIN_EMAIL}"
  echo "  Multi-tenant:  ${MULTI_TENANT}"
  echo "  Env:           ${ENV_FILE}"
  echo "  Compose:       ${COMPOSE_FILE}"
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    echo "  Modo:          dry-run (não sobe containers)"
  elif [[ "${SKIP_UP}" -eq 1 ]]; then
    echo "  Modo:          só .env + validação"
  else
    echo "  Modo:          gerar .env + docker compose up"
  fi
  echo

  if [[ "${ASSUME_YES}" -eq 1 ]]; then
    return 0
  fi
  if [[ ! -t 0 ]]; then
    err "Use --yes em modo não interativo"
    exit 1
  fi
  local answer
  read -r -p "Continuar? [y/N] " answer
  case "${answer}" in
    y|Y|yes|YES) return 0 ;;
    *) err "Instalação cancelada"; exit 1 ;;
  esac
}

run_deploy_check() {
  log "Validando configuração..."
  COMPOSE_FILE="${COMPOSE_FILE}" bash "${DEPLOY_CHECK}" "${ENV_FILE}"
}

compose_up() {
  log "Subindo stack de produção..."
  local args=(-f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d)
  if [[ "${NO_BUILD}" -eq 0 ]]; then
    args+=(--build)
  fi
  docker compose "${args[@]}"
  ok "Containers iniciados"
}

wait_ready() {
  log "Aguardando API ficar pronta (timeout ${HEALTH_TIMEOUT}s)..."
  local elapsed=0
  local url="http://127.0.0.1:3000/health/ready"

  # Em produção a API não está publicada na host — checar via docker exec
  while [[ "${elapsed}" -lt "${HEALTH_TIMEOUT}" ]]; do
    if docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T api \
      node -e "require('http').get('http://127.0.0.1:3000/health/ready', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" \
      >/dev/null 2>&1; then
      ok "API healthy (/health/ready)"
      return 0
    fi
    sleep 5
    elapsed=$((elapsed + 5))
    echo -n "."
  done
  echo
  warn "Timeout aguardando /health/ready — verifique: docker compose -f ${COMPOSE_FILE} logs api"
  return 1
}

print_next_steps() {
  echo
  ok "Instalação concluída"
  echo
  echo "Próximos passos:"
  echo "  1. Aponte o DNS do domínio para esta VPS"
  echo "  2. Configure HTTPS (EasyPanel / Caddy / Nginx)"
  echo "  3. Login admin: ${DOMAIN}/admin/login"
  echo "     E-mail: ${ADMIN_EMAIL}"
  echo "  4. Configure integrações em ${DOMAIN}/admin/integracoes"
  if [[ "${MULTI_TENANT}" == "true" ]]; then
    echo "  5. Plataforma SaaS: ${DOMAIN}/platform"
  fi
  echo
  echo "Documentação: docs/deploy/install.md"
  echo "EasyPanel:    docs/deploy/easypanel.md"
  echo "Runbook:      docs/operations/runbook.md"
}

main() {
  echo
  echo "╔══════════════════════════════════════╗"
  echo "║     AguiaAuto — Instalador           ║"
  echo "╚══════════════════════════════════════╝"
  echo

  check_prereqs
  collect_inputs

  if [[ -f "${ENV_FILE}" && "${DRY_RUN}" -eq 0 ]]; then
    warn "Arquivo ${ENV_FILE} já existe"
    if [[ "${ASSUME_YES}" -eq 0 && -t 0 ]]; then
      local overwrite
      read -r -p "Sobrescrever? [y/N] " overwrite
      case "${overwrite}" in
        y|Y|yes|YES) ;;
        *) err "Mantendo .env existente. Abortado."; exit 1 ;;
      esac
    elif [[ "${ASSUME_YES}" -eq 0 ]]; then
      err "Use --yes para sobrescrever ${ENV_FILE}"
      exit 1
    fi
  fi

  confirm_install

  local out_env="${ENV_FILE}"
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    out_env="${ROOT_DIR}/.env.install.tmp"
  fi

  write_env "${out_env}"

  if [[ "${DRY_RUN}" -eq 1 ]]; then
    ENV_FILE="${out_env}" COMPOSE_FILE="${COMPOSE_FILE}" bash "${DEPLOY_CHECK}" "${out_env}" || true
    ok "Dry-run OK — arquivo: ${out_env}"
    echo "Revise e copie para .env quando estiver pronto."
    exit 0
  fi

  run_deploy_check

  if [[ "${SKIP_UP}" -eq 1 ]]; then
    ok ".env validado. Suba com:"
    echo "  docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} up -d --build"
    exit 0
  fi

  compose_up
  wait_ready || true
  print_next_steps
}

main "$@"
