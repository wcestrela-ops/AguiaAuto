# AG SMS Hub — Primeira entrega (Fase 1)

Plataforma PWA para gerenciamento e envio de comandos SMS a rastreadores veiculares.

## Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- npm (workspaces na raiz do monorepo)

## Instalação rápida

```bash
# 1. Clonar e instalar dependências
cd /caminho/do/repositorio
npm install

# 2. Configurar ambiente
cp .env.sms-hub.example .env.sms-hub

# 3. Subir PostgreSQL e Redis
docker compose -f docker-compose.sms-hub.yml up -d sms-hub-postgres sms-hub-redis

# 4. Migrations e seed
npm run sms-hub:migration:run
npm run sms-hub:seed

# 5. Iniciar API e frontend (dois terminais)
npm run dev:sms-hub-api   # http://localhost:4000
npm run dev:sms-hub-web   # http://localhost:5174
```

## Docker Compose completo

Para subir API + Web + banco + Redis:

```bash
cp .env.sms-hub.example .env.sms-hub
docker compose -f docker-compose.sms-hub.yml up -d --build
```

| Serviço | URL |
|---------|-----|
| PWA | http://localhost:5174 |
| API | http://localhost:4000 |
| OpenAPI (Swagger) | http://localhost:4000/api/docs |
| PostgreSQL | localhost:5433 |
| Redis | localhost:6380 |

## Usuários de desenvolvimento

Após o seed:

| Papel | E-mail | Senha |
|-------|--------|-------|
| Super Admin | admin@agsmshub.local | admin123456 |
| Operador (Empresa Teste) | operador@empresa.local | operador123456 |

Altere via variáveis `SMS_HUB_ADMIN_PASSWORD` e `SMS_HUB_OPERATOR_PASSWORD` antes do seed.

## Comandos npm (raiz)

| Comando | Descrição |
|---------|-----------|
| `npm run dev:sms-hub-api` | API NestJS em modo watch |
| `npm run dev:sms-hub-web` | Vite dev server (porta 5174) |
| `npm run build:sms-hub-api` | Build produção da API |
| `npm run build:sms-hub-web` | Build produção da PWA |
| `npm run sms-hub:migration:run` | Executar migrations TypeORM |
| `npm run sms-hub:migration:revert` | Reverter última migration |
| `npm run sms-hub:seed` | Popular admin, empresa e operador |
| `npm run test:sms-hub-api` | Testes unitários Jest |
| `npm run test:sms-hub-api:e2e` | Testes E2E (requer DB) |
| `npm run test:sms-hub-web` | Testes Vitest do frontend |

## Migrations

As migrations ficam em `services/sms-hub-api/src/shared/database/migrations/`.

```bash
# Com .env.sms-hub carregado ou SMS_HUB_DATABASE_URL exportada
cd services/sms-hub-api
npm run migration:run
npm run seed
```

## OpenAPI

Documentação interativa disponível em:

```
http://localhost:4000/api/docs
```

Endpoints implementados na Fase 1 (prefixo **`/api/v1/sms`**):

- `POST /api/v1/sms/auth/bridge` — emite JWT SMS a partir do token admin Águia
- `POST /api/v1/sms/auth/login`
- `POST /api/v1/sms/auth/refresh`
- `POST /api/v1/sms/auth/logout`
- `POST /api/v1/sms/auth/logout-all`
- `GET /api/v1/sms/auth/me`
- `POST /api/v1/sms/auth/forgot-password` (501 — não implementado)
- `POST /api/v1/sms/auth/reset-password` (501 — não implementado)
- `GET /api/v1/sms/dashboard`
- `GET /api/v1/sms/health`

## Integração com Águia (atual)

O SMS **não é mais um sistema separado** para operação diária. Segue o mesmo padrão do WhatsApp:

| Camada | Onde fica |
|--------|-----------|
| Gateways SMS | `@aguia/sms` → tabelas `sms_providers`, `sms_dispatches` no **banco Águia** |
| Admin | `/admin/sms` (gateways) + `/admin/veiculos` (chip SIM, sync GPSWOX) |
| Failover 4G→SMS | `vehicle-service.js` → `@aguia/sms` (sem HTTP externo) |
| Alertas/cobrança | `services/api/src/services/sms.js` (`sendText`, `sendBillingReminder`) |

O diretório `services/sms-hub-api/` permanece no repositório como legado; **não é necessário** para instalação unificada.

### Sincronizar veículos do GPSWOX

```bash
# Admin autenticado
POST /v1/admin/veiculos/sync-gpswox
{ "dry_run": true }   # prévia
{ "dry_run": false }  # importa device_id, nome, chip SIM, IMEI, modelo
```

Requer GPSWOX configurado em Integrações e clientes Águia com `gpswox_user_id` vinculado.

---

## Instalação legada (SMS Hub standalone) (painel unificado)

O módulo AG SMS está embutido em **`apps/web`** em `/admin/sms`, com item **AG SMS** no menu admin.

### Failover 4G → SMS (comandos veiculares)

Quando o cliente envia **bloquear/desbloquear** (ou outro comando) pelo painel:

1. A API Águia tenta primeiro via **GPSWOX (4G)**
2. Se o 4G falhar de forma elegível (gateway offline, conexão recusada, etc.)
3. A API chama **`POST /api/v1/sms/internal/dispatches/send`** no SMS Hub
4. SMS Hub envia pelo gateway configurado (FAKE em dev) para o **`tracker_phone`** do veículo
5. Comandos SMS mapeados: `RELAY,1#` (bloqueio), `RELAY,0#` (desbloqueio), `WHERE#` (localizar)

Configure no admin do veículo: **Número do chip (SMS failover)**  
Env: `SMS_HUB_URL`, `AGUIA_SERVICE_SECRET` (distinto do `ADMIN_SECRET`, só servidor)

### Segurança P0 (implementado)

- **Secrets separados:** `ADMIN_SECRET` (browser/admin) ≠ `AGUIA_SERVICE_SECRET` (server-to-server)
- **Rate limit:** login Águia, comandos veiculares, login/bridge SMS Hub, dispatch interno
- **JWT SMS Hub:** falha em produção se `SMS_HUB_JWT_SECRET` ausente ou padrão dev
- **Idempotência SMS:** header `Idempotency-Key` no failover (1 min por veículo+ação)

### Segurança P1 (implementado)

- **Isolamento por empresa:** `CompanyGuard` no dashboard; `company_id` em dispatches (header `X-Company-Id` no failover Águia)
- **Fila assíncrona:** BullMQ + Redis para processar dispatches (`SMS_HUB_QUEUE_ENABLED=false` cai para síncrono)
- **Auditoria admin (Águia):** tabela `audit_logs`, hooks em veículos/comandos, `GET /v1/admin/audit`
- **Webhooks assinados:** Asaas (`asaas-access-token`), Mercado Pago (`x-signature` HMAC), GPSWOX (Bearer / `x-webhook-secret`)

Env adicional Águia: `SMS_HUB_DEFAULT_COMPANY_ID` (UUID do seed SMS Hub)

## PWA

- Instalável via navegador (Add to Home Screen)
- Navegação inferior mobile: Início, Dispositivos, Enviar, Histórico, Mais
- Sidebar recolhível no desktop (≥900px)
- Tema escuro mobile-first

## Estrutura de arquivos

```
apps/sms-hub-web/          # React PWA
services/sms-hub-api/      # NestJS API
docker-compose.sms-hub.yml # Infra dedicada
.env.sms-hub.example       # Variáveis de ambiente
AGENTS.md                  # Guia para IAs
docs/SMS-HUB.md            # Este arquivo
```

## Testes

```bash
# Unitários (sem banco)
npm run test:sms-hub-api

# E2E (precisa SMS_HUB_DATABASE_URL apontando para Postgres)
export SMS_HUB_DATABASE_URL=postgresql://ag_smshub:ag_smshub@localhost:5433/ag_smshub
npm run test:sms-hub-api:e2e

# Frontend
npm run test:sms-hub-web
```

## Limitações da Fase 1

- Sem CRUD de empresas, usuários, biblioteca, dispositivos ou gateways (além do seed)
- Sem envio real de SMS (gateway FAKE em dev)
- Páginas além de Login/Início são placeholders
- Recuperação de senha não implementada

## Próxima entrega recomendada

1. Módulos **companies** e **users** com CRUD admin
2. Seed expandido (fabricante Joker, protocolo GT06, comandos de exemplo)
3. Gateways reais (ANDROID / SMSMarket)
4. Testes E2E completos do fluxo failover

## Referência

Especificação completa do MVP: prompt mestre AG SMS Hub (seções 1–67).

Para agentes de IA: consulte também `AGENTS.md` na raiz do repositório.
