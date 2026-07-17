# Deploy no EasyPanel — AguiaAuto SaaS

Guia passo a passo para publicar o monorepo em VPS com [EasyPanel](https://easypanel.io), usando `docker-compose.prod.yml`.

## Arquitetura em produção

```text
Internet (HTTPS)
       ↓
  EasyPanel proxy → web:80 (Nginx)
       ├── /        → SPA React (PWA + admin + platform)
       ├── /api/*   → api:3000
       └── /ws      → api:3000 (WebSocket)

Rede interna (aguia_network):
  postgres · redis · gpswox-gateway · api · worker · scheduler
```

| Serviço | Função | Exposto |
|---------|--------|---------|
| `web` | Frontend + reverse proxy Nginx | Sim (domínio público) |
| `api` | API Express | Não (via Nginx `/api`) |
| `worker` | Filas BullMQ | Não |
| `scheduler` | Cron/pollers | Não |
| `gpswox-gateway` | Gateway GPSWOX/Traccar | Não |
| `postgres` | Banco principal | Não |
| `redis` | Cache, filas, rate limit | Não |
| `backup` | pg_dump diário (profile) | Não |

---

## Pré-requisitos

- VPS com Docker (EasyPanel instalado)
- Domínio apontando para o IP da VPS (ex.: `app.suaempresa.com.br`)
- Repositório clonado ou imagens GHCR (CD publica em `ghcr.io/<owner>/aguia-*`)

---

## Passo 1 — Criar projeto no EasyPanel

1. **New Project** → nome ex.: `aguiaauto`
2. **Add Service** → **Docker Compose**
3. **Source:** Git (recomendado) ou imagens pré-buildadas
4. **Compose file path:** `docker-compose.prod.yml`
5. **Working directory:** raiz do repositório

---

## Passo 2 — Variáveis de ambiente

1. Copie o template:

```bash
cp .env.production.example .env
```

2. No EasyPanel, cole o conteúdo do `.env` em **Environment** (ou monte o arquivo na raiz do projeto).

3. Variáveis **obrigatórias**:

| Variável | Exemplo | Notas |
|----------|---------|-------|
| `POSTGRES_PASSWORD` | senha forte | Usada por todos os serviços |
| `JWT_SECRET` | ≥ 32 chars | Tokens cliente/admin |
| `ENCRYPTION_KEY` | ≥ 32 chars | Credenciais de integrações |
| `SESSION_SECRET` | ≥ 32 chars | Cookies admin |
| `CORS_ORIGIN` | `https://app.seudominio.com` | Sem barra final |
| `GATEWAY_SECRET` | segredo compartilhado | API ↔ gateway |
| `ADMIN_BOOTSTRAP_EMAIL` | admin@empresa.com | Primeiro superadmin |
| `ADMIN_BOOTSTRAP_PASSWORD` | senha forte | Criado na 1ª subida |

4. Valide localmente (opcional):

```bash
chmod +x scripts/deploy-check.sh
./scripts/deploy-check.sh .env
```

---

## Passo 3 — Domínio e HTTPS

1. No serviço **`web`**, adicione o domínio público no EasyPanel
2. Ative **HTTPS** (Let's Encrypt automático)
3. **Não** exponha `api`, `postgres` ou `redis` publicamente
4. Confirme que `CORS_ORIGIN` usa o mesmo domínio com `https://`

O Nginx em `apps/web/nginx.conf` encaminha:

- `/api/` → `http://api:3000/`
- `/ws` → WebSocket da API

---

## Passo 4 — Deploy

1. Clique **Deploy** no EasyPanel
2. Aguarde build das imagens (`api`, `web`, `gpswox-gateway`) ou pull do GHCR
3. Ordem de subida: `postgres` + `redis` → `gpswox-gateway` → `api` → `worker` + `scheduler` → `web`

### Health checks

| Endpoint | Uso | Esperado |
|----------|-----|----------|
| `GET /health/live` | Liveness (processo vivo) | 200 |
| `GET /health/ready` | Readiness (Postgres ok) | 200 |
| `GET /health` | Diagnóstico completo | 200 ou 503 |

Via domínio público (through Nginx):

```bash
curl -s https://app.seudominio.com/api/health/live
curl -s https://app.seudominio.com/api/health/ready
```

No EasyPanel, configure probes no serviço `api` apontando para `/health/ready` na porta 3000 (rede interna).

---

## Passo 5 — Pós-deploy

### 5.1 Login admin

1. Acesse `https://app.seudominio.com/admin/login`
2. Use `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`
3. Altere a senha em **Segurança** após o primeiro acesso

### 5.2 Integrações

Configure em `/admin/integracoes`:

| Integração | Prioridade |
|------------|------------|
| Gateway GPSWOX | Alta — `GATEWAY_URL` interno + credenciais |
| SMTP | Alta — e-mails transacionais |
| Asaas / Mercado Pago | Média — financeiro |
| Firebase | Média — push notifications |
| WhatsApp / SMS | Conforme plano |

### 5.3 Plataforma SaaS (multi-tenant)

Com `MULTI_TENANT_ENABLED=false` (default), o sistema opera como single-tenant Águia.

Para ativar SaaS:

1. Defina `MULTI_TENANT_ENABLED=true` no `.env`
2. Redeploy (restart `api`, `worker`, `scheduler`)
3. Acesse `/platform` com superadmin do tenant #1
4. Onboarding B2B em `/platform/onboarding`

Ver [`docs/multi-tenancy/README.md`](../multi-tenancy/README.md).

---

## Passo 6 — Backup (opcional)

Ative o serviço `backup` com profile:

```bash
docker compose -f docker-compose.prod.yml --profile backup up -d backup
```

Ou adicione `--profile backup` no EasyPanel. Retenção configurável via `RETENTION_DAILY`, `RETENTION_WEEKLY`, `RETENTION_MONTHLY`.

---

## Deploy com imagens GHCR (CD)

O workflow `.github/workflows/cd.yml` publica imagens no push em `main`:

- `ghcr.io/<owner>/aguia-api`
- `ghcr.io/<owner>/aguia-web`
- `ghcr.io/<owner>/aguia-gateway`

Para usar imagens em vez de build local, substitua `build:` por `image:` nos serviços correspondentes (exemplo em comentário no `docker-compose.prod.yml`).

---

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| 502 no domínio | `api` não healthy | Logs do container `api`; verificar Postgres |
| CORS error | `CORS_ORIGIN` errado | Deve ser exatamente a URL pública HTTPS |
| Login admin falha | Bootstrap não rodou | Conferir `ADMIN_BOOTSTRAP_*` e logs da API |
| WebSocket cai | Proxy sem upgrade | Nginx já configura `/ws`; verificar EasyPanel |
| Gateway UNAVAILABLE | GPSWOX offline | `/health` → componente `gpswoxGateway` |

Operação contínua: [`docs/operations/runbook.md`](../operations/runbook.md).
