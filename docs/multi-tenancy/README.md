# Multi-tenancy e modularidade — Fases 1–6

Documentação da transformação SaaS multi-tenant do AguiaAuto.

## Feature flag

```env
# false (default) — comportamento single-tenant legado (tenant_id=1)
# true — ativa isolamento por tenant e verificação de módulos
MULTI_TENANT_ENABLED=false
```

Enquanto a flag estiver **desligada**, o sistema opera como antes: todos os dados pertencem ao tenant `1` (Águia) e todos os módulos são considerados ativos.

---

## Fase 1 — Fundação multi-tenant

### Entidade Tenant
- Tabela `tenants` expandida (`legal_name`, `trade_name`, `slug`, `status`, `timezone`, `locale`, `currency`)
- Seed: tenant `1` = **Águia Gestão Veicular** (`slug: aguia`)

### Camada TenantContext
| Componente | Arquivo |
|------------|---------|
| Config / flag | `services/api/src/lib/tenant/tenant-config.js` |
| SQL helpers | `services/api/src/lib/tenant/tenant-query.js` |
| Resolver | `services/api/src/lib/tenant/tenant-resolver.js` |
| Guard | `services/api/src/lib/tenant/tenant-guard.js` |
| Middleware | `services/api/src/middleware/tenant-context.js` |

### Migrations Fase 1
1. `migrate-tenants-foundation.js`
2. `migrate-aguia-tenant-seed.js`

### Repositórios (filtro tenant quando flag ativa)
user, vehicle, invoice, subscription, integrations store

---

## Fase 2 — RBAC platform + isolamento expandido

### Papéis platform
| Papel | Escopo |
|-------|--------|
| `platform_super_admin` | Acesso total à plataforma |
| `platform_admin` | Gestão tenants e módulos |
| `platform_support` | Suporte + impersonação controlada |
| `platform_finance` | Visão financeira/operacional |

Aliases tenant: `TENANT_OWNER` → `superadmin`, `TENANT_ADMIN` → `admin`, etc.

### Painel master — `/v1/platform/*`
| Rota | Descrição |
|------|-----------|
| `GET /health` | Saúde API, filas, workers |
| `GET /tenants` | Listar empresas |
| `POST /tenants` | Criar empresa |
| `GET /tenants/:id` | Detalhe + módulos |
| `PATCH /tenants/:id` | Editar empresa |
| `POST /tenants/:id/suspend` | Suspender |
| `GET /modules` | Catálogo global |
| `POST /tenants/:id/modules/:code/activate` | Ativar módulo |
| `POST /tenants/:id/modules/:code/suspend` | Suspender módulo |

Auth: `platformAuth` + permissões `platform.*`. Superadmin tenant #1 também acessa (transição).

### Migration Fase 2
`migrate-phase2-tenant-tables.js` — `tenant_id` em alert_events, contracts, installations, billing, emergency, webhook_events, etc.

### Repositórios adicionais
plan, audit, alert (+ backfill via JOIN users/vehicles)

---

## Fase 3 — Sistema modular

### Tabelas
- **`modules`** — catálogo global (18 módulos: TRACKING, FINANCE, WHATSAPP, …)
- **`tenant_modules`** — vínculo empresa ↔ módulo (status, source, expires_at)

### ModuleAccessService
- `isActive(tenantId, code)` — verifica módulo contratado
- `getActiveModules(tenantId)` — lista para frontend
- `checkDependencies()` — dependências entre módulos

### Middleware
- `requireModule()` — bloqueia API se módulo inativo
- Mapeamento automático: `lib/modules/route-modules.js`

### Admin tenant
- `GET /v1/admin/modules` — módulos ativos da empresa

### Migration Fase 3
`migrate-phase3-modules.js` — seed catálogo + ativa todos os módulos para tenant Águia

---

## Fase 4 — Planos SaaS, assinaturas e limites

### Tabelas (prefixo `saas_` — distinto de planos B2C `plans`)
| Tabela | Descrição |
|--------|-----------|
| `saas_plans` | Planos comerciais da plataforma |
| `saas_plan_modules` | Módulos incluídos por plano |
| `module_prices` | Preços por módulo/ciclo |
| `tenant_saas_subscriptions` | Assinatura SaaS por empresa |
| `tenant_usage_limits` | Limites configuráveis por tenant |
| `tenant_usage_metrics` | Cache de métricas medidas |

Plano seed: **aguia-completo** — tenant #1 com assinatura ACTIVE e limites enterprise.

### Serviços
| Serviço | Responsabilidade |
|---------|------------------|
| `SaasBillingService` | Planos, assinaturas, sync módulos do plano |
| `UsageMeteringService` | Medição e verificação de limites |

### Integração com módulos
- `ModuleAccessService` verifica assinatura SaaS ativa quando `MULTI_TENANT_ENABLED=true`
- `requireUsageLimit(metric)` — middleware HTTP 429 quando limite excedido

### Painel master — billing SaaS
| Rota | Descrição |
|------|-----------|
| `GET /v1/platform/saas-plans` | Listar planos |
| `POST /v1/platform/saas-plans` | Criar plano |
| `GET /v1/platform/saas-plans/:id` | Detalhe + módulos |
| `PATCH /v1/platform/saas-plans/:id` | Editar plano |
| `PUT /v1/platform/saas-plans/:id/modules` | Módulos do plano |
| `GET /v1/platform/tenants/:id/subscription` | Assinatura ativa |
| `POST /v1/platform/tenants/:id/subscription` | Atribuir plano |
| `PATCH /v1/platform/tenants/:id/subscription/:subId` | Alterar status |
| `GET /v1/platform/tenants/:id/usage` | Uso vs limites |
| `PUT /v1/platform/tenants/:id/usage-limits` | Configurar limites |

Permissões: `platform.billing.view`, `platform.billing.manage`

### Admin tenant
| Rota | Descrição |
|------|-----------|
| `GET /v1/admin/subscription` | Assinatura e plano da empresa |
| `GET /v1/admin/usage` | Consumo vs limites |

Permissão: `billing.view`

### Migration Fase 4
`migrate-phase4-saas-billing.js`

---

## Fase 5 — Painel master UI (frontend)

SPA React em `apps/web` — rota `/platform/*`, reutiliza login admin (`/admin/login`).

### Acesso
- Mesma sessão admin (cookies HttpOnly + CSRF)
- Gate: `PlatformSessionGate` verifica papel `platform_*`, permissão `platform.*` ou `superadmin`
- Operadores `platform_*` são redirecionados para `/platform` após login

### Páginas
| Rota | Componente | API |
|------|------------|-----|
| `/platform` | Dashboard | `GET /v1/platform/health` |
| `/platform/tenants` | Empresas | `GET/POST /v1/platform/tenants` |
| `/platform/tenants/:id` | Detalhe | tenant, módulos, assinatura, uso |
| `/platform/modules` | Catálogo | `GET /v1/platform/modules` |
| `/platform/saas-plans` | Planos SaaS | CRUD `/v1/platform/saas-plans` |

### Arquivos principais
| Arquivo | Função |
|---------|--------|
| `apps/web/src/lib/platform-access.js` | RBAC frontend |
| `apps/web/src/components/PlatformSessionGate.jsx` | Gate de sessão |
| `apps/web/src/pages/platform/PlatformLayout.jsx` | Layout + nav |
| `apps/web/src/api/client.js` | Métodos `getPlatform*` |

Link **Plataforma SaaS** no sidebar admin para usuários com acesso.

---

## Fase 6 — TrackingProvider formal + external_entity_mappings

### Tabelas
| Tabela | Descrição |
|--------|-----------|
| `tenant_tracking_configs` | Provedor padrão e estratégia de sync por tenant |
| `external_entity_mappings` | Vínculo interno ↔ ID externo (GPSWOX/Traccar) |

### Estratégias de sync
| Estratégia | Comportamento |
|------------|---------------|
| `PROVIDER_MASTER` | Plataforma externa é fonte de verdade (default) |
| `READ_ONLY` | Aguia lê posição/histórico; bloqueia comandos e writes |

### Camada TrackingProvider
| Componente | Arquivo |
|------------|---------|
| Interface base | `lib/tracking/tracking-provider.js` |
| Adapter gateway | `lib/tracking/gateway-tracking-provider.js` |
| Factory por tenant | `lib/tracking/tracking-provider-factory.js` |
| Facade | `services/tracking-service.js` |
| Mappings | `services/external-entity-mapping-service.js` |

Provedores suportados: **gpswox**, **traccar** (via gateway existente).

### Integração
- `provisioning-service` — cria usuário na plataforma + grava mapping
- `gpswox-sync-service` — sync de devices + mappings de veículos
- `vehicle-service` — comandos/histórico/compartilhamento via `TrackingService`

### API platform
| Rota | Descrição |
|------|-----------|
| `GET /v1/platform/tenants/:id/tracking-config` | Config de rastreamento |
| `PATCH /v1/platform/tenants/:id/tracking-config` | Alterar provider/strategy |
| `GET /v1/platform/tenants/:id/entity-mappings` | Listar mappings |

### Migration Fase 6
`migrate-phase6-tracking-provider.js` — backfill de `users.gpswox_user_id`, `traccar_user_id` e `vehicles.tracker_device_id`

---

## Testes

```bash
npm run test:api
```

| Suite | Escopo |
|-------|--------|
| `test/tenant/tenant-isolation.test.js` | Contexto, spoof, cache prefix |
| `test/modules/module-access.test.js` | Platform roles, route→module map |
| `test/modules/saas-billing.test.js` | Billing SaaS, limites de uso |
| `apps/web/src/lib/platform-access.test.js` | RBAC painel master |
| `test/lib/tracking-provider.test.js` | TrackingProvider, sync strategies, factory |

**73 testes API + testes web** passando.

---

## Próximas fases

| Fase | Foco |
|------|------|
| 7 | Integrações SHARED/OWN por tenant |
| 8 | Onboarding B2B empresa |

Ver ADR: [`docs/architecture/adr/001-multi-tenant-modular-saas.md`](../architecture/adr/001-multi-tenant-modular-saas.md)
