#!/usr/bin/env bash
# Smoke test do instalador (sem Docker / sem subir stack)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

echo "=== test-install: sintaxe ==="
bash -n scripts/install.sh
bash -n scripts/deploy-check.sh
echo "OK bash -n"

echo "=== test-install: dry-run ==="
rm -f .env.install.tmp
./scripts/install.sh \
  --domain https://app.exemplo.com.br \
  --admin-email admin@exemplo.com.br \
  --admin-password 'SenhaForteTeste10' \
  --postgres-password 'PgSenhaForteTeste10' \
  --multi-tenant false \
  --dry-run \
  --yes

test -f .env.install.tmp
grep -q '^CORS_ORIGIN=https://app.exemplo.com.br$' .env.install.tmp
grep -q '^ADMIN_BOOTSTRAP_EMAIL=admin@exemplo.com.br$' .env.install.tmp
grep -q '^POSTGRES_PASSWORD=PgSenhaForteTeste10$' .env.install.tmp
grep -q '^JWT_SECRET=' .env.install.tmp
grep -q '^ENCRYPTION_KEY=' .env.install.tmp
grep -q '^SESSION_SECRET=' .env.install.tmp
grep -q '^GATEWAY_SECRET=' .env.install.tmp
grep -q '^MULTI_TENANT_ENABLED=false$' .env.install.tmp
grep -q 'postgresql://aguia:PgSenhaForteTeste10@postgres:5432/aguia' .env.install.tmp

# placeholders não devem permanecer
if grep -E 'troque-por|altere-este' .env.install.tmp >/dev/null; then
  echo "FAIL: placeholders ainda presentes no .env.install.tmp"
  exit 1
fi

rm -f .env.install.tmp
echo "OK dry-run"
echo "=== test-install: passou ==="
