# Auditoria — Transformação SaaS Multi-tenant Modular

**Projeto:** AguiaAuto / Águia Gestão Veicular  
**Repositório:** monorepo `aguia-gestao-veicular`  
**Data:** 2026-07-17  
**Fase:** 0 — Auditoria (somente diagnóstico, sem alterações de produção)

---

## Sumário executivo

O AguiaAuto é um **monorepo maduro** com PWA (cliente + admin + instalador), API Express, gateway de rastreamento (GPSWOX + Traccar), financeiro (Asaas + Mercado Pago), WhatsApp/SMS multi-provedor, filas BullMQ, Redis, WebSocket e Docker/EasyPanel. Funcionalidades de produto estão **amplamente implementadas** para uma única empresa.

A base para multi-tenancy existe **parcialmente** (`tenants`, `users.tenant_id`), mas **não há isolamento de dados**. Não existe catálogo de módulos, assinaturas por tenant, painel master, white label por domínio, nem `TenantContext`.

A transformação proposta é **viável de forma incremental** reutilizando gateways, pacotes de integração, RBAC, filas e PWA. O maior risco é **vazamento cross-tenant** durante a adição de `tenant_id` em ~45 tabelas e ~31 repositórios.

**Recomendação:** iniciar Fase 1 com fundação multi-tenant atrás de feature flag, migrar Águia como tenant #1, e só então ativar módulos/assinaturas.

---

## 1. Estado atual

### 1.1 Stack real

| Camada | Tecnologia | Versão / notas |
|--------|------------|----------------|
| Runtime | Node.js | 20 (Docker/CI); ambiente dev pode usar 22 |
| Monorepo | npm workspaces | `apps/*`, `services/*`, `packages/*` |
| API | Express | 4.18, CommonJS |
| Frontend | React + Vite | 18.3 + Vite 5.4 |
| PWA | vite-plugin-pwa | Service worker + manifest |
| Banco | PostgreSQL | 16-alpine |
| Cache/Filas | Redis + BullMQ | 7 + 5.34 (produção) |
| WebSocket | ws | Path `/ws` na API |
| Auth | JWT + refresh tokens | Argon2id/bcrypt, 2FA TOTP (admin) |
| Maps | Leaflet | Cliente PWA |
| Push | Firebase | Cliente + firebase-admin na API |
| Gateway tracking | Express + Playwright | GPSWOX API + fallback UI; Traccar REST |
| CI/CD | GitHub Actions | Test + build web; GHCR para imagens |
| Deploy | Docker Compose | Dev 4 serviços; prod 7+ serviços |

### 1.2 Estrutura do monorepo

```
/workspace/
├── apps/web/                    @aguia/web — PWA, admin, instalador, landing
├── services/api/                @aguia/api — API, worker, scheduler, 33 migrations
├── services/gpswox-gateway/     @aguia/gpswox-gateway — motor rastreamento interno
├── packages/shared/             Constantes (status veículo, alertas)
├── packages/integrations/       Config integrações (PostgreSQL + schemas + encryption)
├── packages/whatsapp/           Evolution, WAHA, Meta Cloud + failover
├── packages/sms/                Fake, Android, HTTP Gateway, SMSMarket + failover
├── docs/                        FASE-3-SEGURANCA, SMS-HUB, este documento
├── scripts/backup-postgres.sh   Backup prod (profile Docker)
├── docker-compose.yml           Dev: postgres, api, gateway, web
└── docker-compose.prod.yml        Prod: + redis, worker, scheduler, backup
```

### 1.3 Mapa de arquitetura atual

```mermaid
flowchart TB
  subgraph clients [Clientes]
    PWA[PWA apps/web]
  end

  subgraph edge [Edge]
    Nginx[nginx apps/web]
  end

  subgraph api_layer [API services/api]
    API[Express PROCESS_ROLE=api]
    WS[WebSocket /ws]
    Worker[worker.js BullMQ]
    Scheduler[scheduler.js]
  end

  subgraph data [Dados]
    PG[(PostgreSQL)]
    Redis[(Redis)]
  end

  subgraph gateways [Gateways internos]
    TGW[gpswox-gateway :3001]
    WA[@aguia/whatsapp]
    SMS[@aguia/sms]
    INT[@aguia/integrations]
  end

  subgraph external [Externos]
    GPSWOX[GPSWOX]
    Traccar[Traccar]
    Asaas[Asaas]
    MP[Mercado Pago]
    Meta[Meta WhatsApp]
  end

  PWA --> Nginx
  Nginx -->|/api/*| API
  Nginx -->|/ws| WS
  API --> PG
  API --> Redis
  API --> TGW
  API --> WA
  API --> SMS
  API --> INT
  Worker --> Redis
  Worker --> PG
  Worker --> TGW
  Scheduler --> Redis
  Scheduler --> PG
  TGW --> INT
  TGW --> GPSWOX
  TGW --> Traccar
  INT --> PG
  API --> Asaas
  API --> MP
  WA --> Meta
```

### 1.4 Módulos de produto já implementados

| Domínio | Backend | Frontend | Maturidade |
|---------|---------|----------|------------|
| Auth cliente | `/v1/auth/*` | `/login`, `/cadastro` | ✅ Completo |
| Onboarding cliente | `/v1/onboarding/*` | Cadastro + contrato | ✅ Completo |
| Dashboard cliente | `/v1/dashboard` | `/app` | ✅ Completo |
| Veículos + mapa | `/v1/veiculos/*` | `/app/veiculos` | ✅ Completo |
| Comandos bloqueio/desbloqueio | vehicle-service + SMS failover | Detalhe veículo | ✅ Completo |
| Financeiro cliente | `/v1/financeiro/*` | `/app/financeiro` | ✅ Completo |
| Alertas | `/v1/alertas/*` | `/app/alertas` | ✅ Completo |
| Contratos digitais | `/v1/contratos/*` | `/app/contratos` | ✅ Completo |
| Frota (docs/manutenção) | `/v1/frota/*` | `/app/frota` | ✅ Completo |
| Emergência SOS | `/v1/emergencia/*` | `/app/emergencia` | ✅ Completo |
| Indicações | `/v1/indicacoes/*` | Integrado cadastro | ✅ Completo |
| Instalador | `/v1/instalador/*` | `/instalador/*` | ✅ Completo |
| Admin integrações | `/v1/admin/integracoes/*` | `/admin/integracoes` | ✅ Completo |
| Admin WhatsApp/SMS | rotas admin | `/admin/whatsapp`, `/admin/sms` | ✅ Completo |
| Admin veículos/clientes/financeiro | rotas admin | páginas admin | ✅ Completo |
| Admin planos | `/v1/admin/plans` | `/admin/planos` | ✅ Parcial* |
| Landing page | `/v1/site`, `/v1/admin/site` | `/`, `/admin/site` | ✅ Single-tenant |
| Export Excel/PDF | `/v1/admin/export/*` | botões export | ✅ Completo |
| Auditoria admin | `/v1/admin/audit/*` | `/admin/auditoria` | ✅ Completo |
| Segurança admin | `/v1/admin/security/*` | `/admin/seguranca` | ✅ Completo |
| LGPD | `/v1/lgpd/*`, `/v1/admin/lgpd/*` | Sem UI PWA | 🟡 Parcial |
| Ops dashboard | `/v1/admin/dashboard/operations` | Dashboard admin | ✅ Completo |
| Rastreamento dual | gateway + sync | Admin veículos | ✅ Completo |
| Filas/workers | 7 filas BullMQ | — | 🟡 4/7 ativas |
| WebSocket | `/ws` server-side | **Sem cliente PWA** | 🟡 Parcial |
| Multi-tenant | tabela `tenants` mínima | — | 🔴 Não operacional |
| Módulos contratáveis | — | — | 🔴 Inexistente |
| Painel master plataforma | — | — | 🔴 Inexistente |
| White label | — | — | 🔴 Inexistente |
| CRM/Leads | — | — | 🔴 Inexistente |

\* `plans` hoje são planos de assinatura **do cliente final** (B2C), não planos SaaS da plataforma.

---

## 2. Banco de dados e entidades

### 2.1 Migrations

**33 arquivos** em `services/api/src/db/migrate-*.js`, executados sequencialmente no bootstrap (`services/api/src/server.js`). Sem arquivos `.sql` avulsos. Pacotes `@aguia/integrations`, `@aguia/whatsapp`, `@aguia/sms` possuem `migrate()` próprio.

### 2.2 Inventário de tabelas (~45)

| Grupo | Tabelas |
|-------|---------|
| Auth/usuários | `users`, `refresh_tokens`, `password_reset_tokens`, `password_history`, `login_attempts`, `user_recovery_codes`, `fcm_tokens` |
| Multi-tenant (inicial) | `tenants` |
| RBAC | `roles`, `permissions`, `role_permissions`, `user_roles` |
| Veículos/planos | `plans`, `vehicles`, `subscriptions`, `vehicle_anchors`, `vehicle_command_logs`, `tracker_models`, `tracker_commands` |
| Financeiro | `invoices`, `payment_gateway_logs`, `billing_notifications`, `billing_reminder_runs`, `referrals`, `asaas_sync_runs`, `tracker_sync_runs` |
| Contratos/instalação | `contract_templates`, `contract_acceptances`, `installation_logs`, `installation_photos` |
| Alertas/frota/SOS | `alert_preferences`, `alert_events`, `vehicle_documents`, `vehicle_maintenance_records`, `fleet_reminder_*`, `user_emergency_contacts`, `emergency_events` |
| Conteúdo | `site_content` |
| Integrações | `integration_configs`, `whatsapp_providers`, `whatsapp_logs`, `sms_providers`, `sms_logs`, `sms_dispatches` |
| Segurança/auditoria | `audit_logs`, `webhook_events`, `lgpd_consents` |

### 2.3 Uso atual de `tenant_id`

| Local | Situação |
|-------|----------|
| `users.tenant_id` | Coluna existe, default `1`, **sem filtro em queries** |
| `audit_logs.tenant_id` | Coluna existe, preenchida com `1` ou do admin |
| `tenants` | Tabela mínima: id, name, slug, active — seed `Default` |
| Demais tabelas | **Sem `tenant_id`** |
| JWT cliente | **Não carrega** `tenant_id` |
| JWT admin | Carrega `tenant_id` do usuário |
| Cache Redis | Chaves **sem** namespace tenant (`tracking:last-position:{vehicleId}`) |
| Filas BullMQ | Jobs **sem** `tenantId` obrigatório |
| WebSocket | Rooms **sem** prefixo tenant |
| `integration_configs` | **Global** (uma config por integration_key) |

### 2.4 Entidades globais vs por tenant (mapeamento proposto)

| Global (sem tenant) | Por tenant (precisará `tenant_id`) |
|---------------------|-------------------------------------|
| Catálogo `modules` (a criar) | `users`, `vehicles`, `invoices`, `subscriptions` |
| Catálogo `plans` SaaS (a criar) | `integration_configs` (ou override por tenant) |
| `permissions` master | `whatsapp_providers`, `sms_providers` |
| Templates globais opcionais | `site_content`, `contract_templates` |
| | `audit_logs`, `webhook_events`, arquivos/uploads |

---

## 3. Autenticação, usuários e permissões

### 3.1 Cliente (PWA)

- **Fluxo:** `POST /v1/auth/login|register` → JWT access + refresh em `refresh_tokens` (`session_type=client`).
- **Middleware:** `jwtAuth` → `req.user = { id, email, role }`.
- **Roles:** `client` (default), `installer` (campo `users.role`).
- **Proteções:** `requireServiceContract` bloqueia app até aceite de contrato.
- **Armazenamento frontend:** localStorage (`access_token`, `refresh_token`).
- **Gap SaaS:** sem `tenant_id` no token; sem distinção platform vs tenant.

### 3.2 Admin (painel empresa)

- **Fluxo:** login individual `/v1/admin/auth/login` → JWT `aud: aguia-admin` + refresh admin.
- **Cookies HttpOnly** + CSRF em mutações; fallback Bearer/localStorage; `ADMIN_SECRET` legado depreciado.
- **2FA TOTP** obrigatório para superadmin/admin/financeiro.
- **RBAC:** 28 permissões (`lib/security/permissions.js`), seed em `rbac-repository.js`.
- **Roles admin atuais:** `superadmin`, `admin`, `operator`, `support`, `financeiro`, `supervisor`.
- **Enforcement:** `adminAuth` + `adminRbac` (prefixo de rota) + `requirePermission` pontual.
- **Gap SaaS:** roles são de **uma empresa**; não há `PLATFORM_SUPER_ADMIN` nem painel master.

### 3.3 Modelo de usuários

Um único `users` para clientes, admins e instaladores (`role` VARCHAR). RBAC normalizado em tabelas separadas para admin. **Não há** tabela `customers` separada — clientes são `users` com `role=client`.

Implicação multi-tenant: `users.tenant_id` já existe; clientes e admins da mesma empresa compartilham tenant. Usuários platform precisarão role global ou tabela separada.

---

## 4. Rastreamento e gateways

### 4.1 Arquitetura existente (alinhada ao prompt)

```
API → integrations/gpswox-gateway.js (HTTP client)
    → services/gpswox-gateway (Express :3001)
        → gpswox-api.js | traccar-api.js | playwright/tracker.js
```

- **Por veículo:** `vehicles.tracking_provider` (`gpswox` | `traccar`).
- **Abstração parcial:** `lib/tracking-platform.js` (settings, labels, sync).
- **Sync agendado:** scheduler → fila `gpswox-sync` → `gpswox-sync-service.js`.
- **Cache:** Redis `tracking:last-position:{vehicleId}` (TTL configurável).
- **Comandos:** `vehicle-service.js` síncrono + failover 4G→SMS; fila `tracking-command` existe mas **não é usada**.
- **Webhooks:** `/webhooks/gpswox`, `/webhooks/traccar` → alertas + âncora.

### 4.2 Gaps vs gateway universal desejado

| Item solicitado | Estado |
|-----------------|--------|
| Interface `TrackingProvider` formal | 🔴 Não existe (lógica espalhada) |
| `TrackingProviderFactory` por tenant | 🔴 Config global via `integration_configs` |
| `external_entity_mappings` | 🔴 Inexistente |
| `PlatformTrackingProvider` | 🔴 Inexistente |
| Estratégias READ_ONLY / PROVIDER_MASTER | 🟡 Comportamento implícito provider-master |
| Assistente de conexão onboarding | 🔴 Inexistente |

### 4.3 Endpoints incompletos no gateway

- `POST /alertas` → 501
- API `GET /v1/veiculos/:id/replay` → 501
- API `GET /v1/veiculos/:id/sensores` → 501
- Health Traccar na API aponta rota inexistente no gateway

---

## 5. Financeiro, WhatsApp, SMS, webhooks

### 5.1 Financeiro

- **Asaas** (`integrations/asaas.js`) + **Mercado Pago** com failover (`payment-gateway-service.js`).
- Faturas, assinaturas, provisioning (`provisioning-service.js`), sync Asaas, lembretes automáticos, baixa manual.
- Webhooks Asaas/MP com idempotência (`webhook_events`).
- **Gap SaaS:** cobrança é B2C (cliente da Águia), não assinatura B2B (empresa tenant na plataforma).

### 5.2 WhatsApp

- Pacote `@aguia/whatsapp`: Evolution, WAHA, Meta Cloud, primary/backup, logs DB.
- Admin CRUD completo; envio usado em alertas, billing, emergência, fleet.

### 5.3 SMS

- Pacote `@aguia/sms`: Fake, Android, HTTP Gateway (padrão GPSWOX), SMSMarket.
- Comandos rastreador, sync chip/IMEI, inbound gateway GPSWOX.
- Documentação: `docs/SMS-HUB.md`, `AGENTS.md`.

### 5.4 Integrações (config)

- `packages/integrations`: schemas para 16 keys (gpswox, traccar, asaas, firebase, smtp, etc.).
- Persistência: `integration_configs` — **global**, uma linha por key.
- Criptografia: `settings_encrypted` + `migrateEncryptedSettings()` no bootstrap.
- **Gap SaaS:** precisa modelo SHARED vs OWN_CREDENTIALS **por tenant**.

### 5.5 Webhooks — bug identificado

Em `services/api/src/modules/webhooks/routes.js`, `isRedisEnabled()` é chamado **sem import**. Com Redis habilitado, webhooks de billing (Asaas/MP) podem falhar com `ReferenceError`. **Corrigir na Fase 1 ou hotfix pré-multi-tenant.**

---

## 6. Infraestrutura: Redis, filas, WebSocket, Docker

### 6.1 Redis e BullMQ

**Filas definidas** (`infrastructure/queues.js`):

| Fila | Producer ativo | Processor |
|------|----------------|-----------|
| `tracking-position` | ✅ Scheduler | ✅ |
| `gpswox-sync` | ✅ Scheduler | ✅ |
| `billing-webhook` | ✅ Webhooks (se Redis OK) | ✅ |
| `notifications` | 🟡 Só Meta webhook | ✅ |
| `tracking-command` | 🔴 Nenhum | ✅ (ocioso) |
| `customer-provisioning` | 🔴 Nenhum | ✅ (ocioso) |
| `contract-generation` | 🔴 Nenhum | ✅ (ocioso) |

**Dev:** `docker-compose.yml` **sem Redis/worker/scheduler** — API usa pollers inline.

**Prod:** `docker-compose.prod.yml` com redis, worker, scheduler, healthchecks, backup opcional.

### 6.2 WebSocket

- Servidor completo: auth JWT, subscribe com ownership, presence Redis, eventos padronizados.
- Nginx prod faz proxy `/ws`.
- **Frontend PWA não consome WebSocket** — polling HTTP para localização.

### 6.3 Docker / EasyPanel

| Serviço | Dev | Prod |
|---------|-----|------|
| postgres | ✅ | ✅ |
| redis | ❌ | ✅ |
| api | ✅ | ✅ |
| worker | ❌ | ✅ |
| scheduler | ❌ | ✅ |
| gpswox-gateway | ✅ | ✅ |
| web (nginx) | ✅ | ✅ |
| backup | ❌ | ✅ profile |

Variáveis: `.env.example`, `.env.production.example`. CD publica imagens GHCR. **Sem guia EasyPanel dedicado** (apenas comentários no compose).

### 6.4 Observabilidade

- `GET /health` — status HEALTHY/DEGRADED/UNAVAILABLE (DB, Redis, filas, gateway).
- Logs JSON com sanitização (`sanitizeLogMeta`).
- Correlation: `requestId` middleware.
- Ops dashboard admin: filas, WebSocket stats, backup marker.
- **Faltam:** `/health/live`, `/health/ready`, métricas por tenant, tracing distribuído.

---

## 7. Frontend

### 7.1 Aplicação única (`apps/web`)

| Área | Rotas | Gate de sessão |
|------|-------|----------------|
| Landing | `/` | Público |
| Cliente PWA | `/app/*` | `ClientSessionGate` |
| Instalador | `/instalador/*` | `ClientSessionGate` (installer) |
| Admin | `/admin/*` | `AdminSessionGate` + `ensureAdminSession()` |

### 7.2 Gaps SaaS no frontend

- Sem resolução de tenant por subdomínio/domínio.
- Sem branding dinâmico (logo, cores, favicon por tenant).
- Sem menu dinâmico por módulos contratados.
- Sem área `/platform` ou `/master` para operadores da plataforma.
- Sem onboarding de empresa (B2B).

---

## 8. Testes

| Pacote | Runner | Testes | Escopo |
|--------|--------|--------|--------|
| @aguia/api | node:test | 43 | Utilitários, regras, segurança parcial |
| @aguia/web | vitest | 13 | Utils, API client |
| @aguia/gpswox-gateway | node:test | 10 | Traccar client, geofence |

**Total: ~66 testes unitários.** Sem testes de integração (DB, Redis, HTTP), sem E2E, **sem testes cross-tenant** (crítico para Fase 1).

CI (`.github/workflows/ci.yml`): `npm test` + `build:web`.

---

## 9. Documentação existente

| Documento | Conteúdo |
|-----------|----------|
| `README.md` | Arquitetura, rotas, roadmap (fases produto ✅) |
| `docs/FASE-3-SEGURANCA.md` | Auth admin, RBAC, 2FA, CSRF, LGPD parcial |
| `docs/SMS-HUB.md` | SMS operacional |
| `AGENTS.md` | Guia SMS para agentes |
| `.env.production.example` | Variáveis prod/EasyPanel |

**Ausente:** multi-tenancy, módulos, tracking gateway formal, onboarding B2B, deploy EasyPanel passo a passo, OpenAPI.

---

## 10. Recursos prontos para reaproveitar

| Recurso | Como reutilizar na transformação |
|---------|----------------------------------|
| `packages/integrations` + encryption | Base para credenciais OWN vs SHARED por tenant |
| `packages/whatsapp` / `packages/sms` | Já são "gateways" — adicionar modo shared/platform |
| `services/gpswox-gateway` | Evoluir para `TrackingProvider` adapters |
| `payment-gateway-service.js` | Modelo para `PaymentProvider` multi-tenant |
| RBAC (`permissions.js`, `rbac-repository.js`) | Estender com permissões platform + tenant |
| BullMQ + scheduler | Adicionar `tenantId` em payloads; filas de provisioning |
| `audit_logs` + `audit-service.js` | Já tem `tenant_id`; expandir eventos |
| PWA único | Branding dinâmico + menu por módulos (sem rebuild por empresa) |
| Feature flag pattern | Usar env `MULTI_TENANT_ENABLED` (a criar) |
| Migration idempotente | Padrão `IF NOT EXISTS` já usado em 33 migrations |

---

## 11. Recursos incompletos

| Item | Impacto |
|------|---------|
| Isolamento tenant | **Crítico** — bloqueia SaaS |
| Catálogo módulos / assinaturas | **Crítico** — modelo comercial |
| Painel master | **Alto** — operação plataforma |
| `TenantContext` | **Crítico** — fundação técnica |
| `integration_configs` global | **Alto** — cada empresa precisa config própria |
| WebSocket no PWA | Médio — UX tempo real |
| 3 filas BullMQ ociosas | Médio — arquitetura async incompleta |
| LGPD UI cliente | Médio — compliance |
| CRM/Leads/Landing multi-tenant | Médio — fases 8–9 |
| White label / domínio custom | Médio — fase 24 |
| Replay/sensores/replay tracking | Baixo — features avançadas |

---

## 12. Débitos técnicos

1. **`isRedisEnabled` não importado** em webhooks billing — bug runtime com Redis.
2. **Migration order:** `migrate-security-phase3` altera `audit_logs` antes de `migrate-admin-audit` criar a tabela (OK em DB existente; problemático em fresh install).
3. **Cache Redis sem tenant namespace** — risco pós-multi-tenant.
4. **README desatualizado** — ainda menciona `ADMIN_SECRET` como fluxo principal.
5. **Comandos veículo síncronos** — fila `tracking-command` não integrada.
6. **Health Traccar** — endpoint fantasma.
7. **Single `users` table** — mistura clientes B2C, admins e instaladores; complexifica RBAC SaaS.
8. **`plans` ambíguo** — planos B2C vs planos SaaS precisam separação conceitual.
9. **Sem `.dockerignore` robusto** — citado como pendência Fase 3.
10. **43 testes unitários** — cobertura baixa para escopo do sistema.

---

## 13. Riscos

| Risco | Severidade | Mitigação proposta |
|-------|------------|-------------------|
| Vazamento cross-tenant (IDOR) | **Crítica** | TenantGuard + testes A/B obrigatórios + review repositórios |
| Quebra tenant Águia em produção | **Crítica** | Feature flag; migration idempotente; dry-run; backup |
| Scope creep (10 fases) | Alta | Entregas incrementais; critérios de done por fase |
| Performance queries com tenant_id | Média | Índices compostos; EXPLAIN em hot paths |
| Config integração por tenant | Alta | Migrar `integration_configs` → tenant scope gradual |
| Redis keys collision | Alta | Namespace `tenant:{id}:` antes de go-live multi-tenant |
| Subdomínio/domínio custom | Média | Fase posterior; resolver tenant por JWT primeiro |
| Equipe operacional | Média | Painel master + docs deploy |

---

## 14. Impacto da multi-tenancy

### Camadas afetadas

| Camada | Esforço | Notas |
|--------|---------|-------|
| Migrations | Alto | ~40 tabelas + índices + backfill tenant_id=1 |
| Repositórios (31) | Alto | Filtro tenant em todo SELECT/UPDATE/DELETE |
| Services (37) | Alto | Propagar TenantContext |
| Middleware | Médio | TenantResolver + guards |
| JWT | Médio | Incluir tenant_id; validar em cada request |
| Redis/BullMQ/WS | Médio | Namespace e payload tenantId |
| `integration_configs` | Alto | Redesign shared/own por tenant |
| Frontend | Médio | Branding, menu módulos, platform area |
| Gateway tracking | Médio | Factory por tenant |
| Testes | Alto | Suite cross-tenant nova |

### O que NÃO muda na Fase 1

- Contratos de API existentes (compatibilidade via tenant default).
- Comportamento do tenant Águia quando flag desligada.
- Estrutura Docker/EasyPanel base.

---

## 15. Estratégia de migration (Águia → tenant #1)

### Princípios

1. **Idempotente** — pode rodar múltiplas vezes.
2. **Dry-run** — relatório sem writes.
3. **Backup** — pg_dump antes de migration em produção.
4. **Sem DELETE** — apenas ADD COLUMN, backfill, CREATE TABLE.
5. **Rollback** — feature flag off + colunas nullable/default; não remover colunas na Fase 1.

### Passos conceituais

```text
1. Expandir tabela tenants (legal_name, trade_name, status, timezone, ...)
2. UPDATE tenants SET name='Águia Gestão Veicular', slug='aguia' WHERE id=1
3. ADD tenant_id DEFAULT 1 em tabelas de negócio (nullable → NOT NULL após backfill)
4. CREATE INDEX (tenant_id, ...) em hot tables
5. Backfill explícito WHERE tenant_id IS NULL → 1
6. Validar contagens: users, vehicles, invoices antes/depois
7. Ativar TenantContext lendo tenant_id=1 para todos até flag multi-tenant
```

### Validação pós-migration

| Entidade | Query validação |
|----------|-----------------|
| users | COUNT(*) WHERE tenant_id IS NULL = 0 |
| vehicles | COUNT(*) sem tenant = 0 |
| invoices | idem |
| integration_configs | mapear para tenant 1 ou manter global temporariamente |

---

## 16. Plano detalhado — Fase 1 (Fundação multi-tenant)

> **Escopo Fase 1:** entidade Tenant completa, TenantContext, `tenant_id` nas tabelas core, isolamento em repositórios críticos, migration Águia, feature flag, testes cross-tenant. **Sem** painel master, **sem** catálogo de módulos comercial, **sem** white label.

### 16.1 Objetivos

- [ ] Tenant Águia operacional como `id=1`, slug `aguia`
- [ ] `TenantContext` disponível em toda request autenticada
- [ ] Isolamento em users, vehicles, invoices, subscriptions, integration_configs
- [ ] Redis/BullMQ preparados com `tenantId` (namespace opcional com flag)
- [ ] Testes: usuário tenant A não acessa dados tenant B
- [ ] `MULTI_TENANT_ENABLED=false` mantém comportamento atual

### 16.2 Arquivos a criar

| Arquivo | Responsabilidade |
|---------|------------------|
| `services/api/src/db/migrate-tenants-foundation.js` | Expandir `tenants`; ADD tenant_id em tabelas core |
| `services/api/src/db/migrate-aguia-tenant-seed.js` | Seed/update tenant Águia; backfill |
| `services/api/src/lib/tenant/tenant-context.js` | AsyncLocalStorage ou req.tenant |
| `services/api/src/lib/tenant/tenant-resolver.js` | Resolve por JWT, subdomínio (stub), webhook |
| `services/api/src/middleware/tenant-context.js` | Injeta contexto após auth |
| `services/api/src/middleware/tenant-guard.js` | Valida recurso pertence ao tenant |
| `services/api/src/repositories/tenant-repository.js` | CRUD tenant |
| `services/api/src/lib/tenant/tenant-query.js` | Helpers `WHERE tenant_id = $n` |
| `services/api/test/tenant/tenant-isolation.test.js` | Testes cross-tenant |
| `docs/multi-tenancy/README.md` | Guia Fase 1 |

### 16.3 Arquivos a alterar (prioridade)

| Arquivo | Alteração |
|---------|-----------|
| `services/api/src/server.js` | Registrar TenantMiddleware; ordem auth → tenant |
| `services/api/src/middleware/jwt-auth.js` | Anexar tenant_id ao req.user |
| `services/api/src/middleware/admin-auth.js` | Validar tenant ativo |
| `services/api/src/services/auth-service.js` | Emitir tenant_id no JWT cliente |
| `services/api/src/repositories/user-repository.js` | Filtro tenant |
| `services/api/src/repositories/vehicle-repository.js` | Filtro tenant |
| `services/api/src/repositories/invoice-repository.js` | Filtro tenant |
| `services/api/src/repositories/subscription-repository.js` | Filtro tenant |
| `packages/integrations/store.js` | tenant_id em integration_configs |
| `services/api/src/infrastructure/tracking-cache.js` | Namespace tenant (com flag) |
| `services/api/src/infrastructure/websocket.js` | Rooms `tenant:{id}:...` |
| `services/api/src/infrastructure/queues.js` | tenantId obrigatório no payload |
| `services/api/src/modules/webhooks/routes.js` | Fix import isRedisEnabled + resolver tenant do webhook |

### 16.4 Migrations Fase 1 (detalhe)

**Migration 1: `migrate-tenants-foundation.js`**

```sql
-- Expandir tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS document_type VARCHAR(20);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS document_number VARCHAR(30);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'pt-BR';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'BRL';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Tabelas core (exemplo — lista completa na implementação)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1; -- planos B2C por tenant
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON vehicles (tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices (tenant_id, created_at DESC);
-- ... demais índices
```

**Migration 2: `migrate-aguia-tenant-seed.js`**

- Atualizar tenant id=1 para dados Águia
- Script dry-run: `node scripts/migrate-tenant-dry-run.js` (a criar)
- Relatório JSON de contagens

### 16.5 Endpoints Fase 1 (mínimos)

| Método | Rota | Notas |
|--------|------|-------|
| GET | `/v1/internal/tenant/context` | Debug (dev only) — retorna contexto |
| — | Sem endpoints públicos novos | Painel master é Fase 5 |

### 16.6 Testes Fase 1 (obrigatórios)

```text
tenant-isolation.test.js
  ✓ user tenant A cannot GET vehicle of tenant B
  ✓ user tenant A cannot UPDATE invoice of tenant B
  ✓ manual tenant_id in body is ignored
  ✓ admin tenant A cannot list users of tenant B
  ✓ cache key tenant A ≠ tenant B (same vehicleId different tenants)
  ✓ JWT without tenant falls back to 1 when flag off
```

### 16.7 Critérios de conclusão Fase 1

1. Migration roda idempotente em DB limpo e DB produção-like.
2. Tenant Águia id=1 com todos os dados backfilled.
3. 10+ testes cross-tenant passando.
4. Nenhuma regressão nos 43+ testes existentes.
5. Feature flag documentada.
6. ADR 001 e este audit commitados.

### 16.8 Ordem de execução sugerida

```text
Semana lógica 1: migrations + tenant repository + seed Águia
Semana lógica 2: TenantContext + middleware + JWT
Semana lógica 3: repositórios core (user, vehicle, invoice)
Semana lógica 4: integration_configs + cache/queue payload
Semana lógica 5: testes isolamento + fix webhook bug + docs
```

---

## 17. Roadmap resumido (Fases 2–10)

| Fase | Foco | Dependência |
|------|------|-------------|
| 2 | RBAC platform + tenant; auditoria expandida | Fase 1 |
| 3 | Modules + TenantModules + ModuleAccessService | Fase 1 |
| 4 | Planos SaaS + assinaturas + limites | Fase 3 |
| 5 | Painel master plataforma | Fases 1–4 |
| 6 | TrackingProvider formal + external_entity_mappings | Fase 1 |
| 7 | Integrações SHARED/OWN por tenant | Fases 1, 3 |
| 8 | Onboarding B2B empresa | Fases 3–4 |
| 9 | Landing + CRM + leads | Fases 3, 8 |
| 10 | Escala, observabilidade, carga, EasyPanel docs | Contínuo |

---

## 18. Decisão ADR

Registrada em: [`docs/architecture/adr/001-multi-tenant-modular-saas.md`](architecture/adr/001-multi-tenant-modular-saas.md)

---

## 19. Conclusão

O AguiaAuto **não precisa ser recriado**. A transformação SaaS multi-tenant modular é **incremental e compatível**, apoiada em gateways, RBAC, filas e PWA já existentes. O gap principal é **isolamento de dados** e **modelo comercial de módulos**, não funcionalidade de rastreamento ou financeiro B2C.

**Próximo passo autorizado:** executar **Fase 1 — Fundação multi-tenant** conforme seção 16, em branch dedicada, com feature flag desligada até testes cross-tenant passarem.

**Não executado neste ciclo (conforme solicitado):**

- Alterações de regras de negócio em produção
- Migrations destrutivas
- Adição de `tenant_id` em código de runtime (somente documentado)

---

*Documento gerado na Fase 0 — Auditoria. Revisar após Fase 1.*
