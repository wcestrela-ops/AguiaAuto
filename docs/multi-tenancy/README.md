# Multi-tenancy e modularidade — Fases 1–3

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

## Testes

```bash
npm run test:api
```

| Suite | Escopo |
|-------|--------|
| `test/tenant/tenant-isolation.test.js` | Contexto, spoof, cache prefix |
| `test/modules/module-access.test.js` | Platform roles, route→module map |

**60 testes** passando.

---

## Próximas fases

| Fase | Foco |
|------|------|
| 4 | Planos SaaS, assinaturas, limites de uso |
| 5 | Painel master UI (frontend) |
| 6 | TrackingProvider formal + external_entity_mappings |
| 7 | Integrações SHARED/OWN por tenant |
| 8 | Onboarding B2B empresa |

Ver ADR: [`docs/architecture/adr/001-multi-tenant-modular-saas.md`](../architecture/adr/001-multi-tenant-modular-saas.md)
