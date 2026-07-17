# Multi-tenancy — Fase 1 (Fundação)

Documentação da fundação multi-tenant implementada na Fase 1.

## Feature flag

```env
# false (default) — comportamento single-tenant legado (tenant_id=1)
# true — ativa filtros de isolamento por tenant
MULTI_TENANT_ENABLED=false
```

Enquanto a flag estiver **desligada**, o sistema opera como antes: todos os dados pertencem ao tenant `1` (Águia).

## Entidade Tenant

Tabela `tenants` expandida com:

- `legal_name`, `trade_name`, `slug`, `status`, `timezone`, `locale`, `currency`
- Seed idempotente: tenant `1` = **Águia Gestão Veicular** (`slug: aguia`)

## Colunas `tenant_id`

Adicionadas (default `1`) em:

- `vehicles`, `invoices`, `subscriptions`, `plans`, `site_content`
- `integration_configs` (PK composta: `tenant_id + integration_key`)
- `users` e `audit_logs` (já existiam na Fase 3)

## Camada de contexto

| Componente | Arquivo |
|------------|---------|
| Config / flag | `services/api/src/lib/tenant/tenant-config.js` |
| SQL helpers | `services/api/src/lib/tenant/tenant-query.js` |
| Resolver | `services/api/src/lib/tenant/tenant-resolver.js` |
| Guard | `services/api/src/lib/tenant/tenant-guard.js` |
| Middleware | `services/api/src/middleware/tenant-context.js` |
| Repository | `services/api/src/repositories/tenant-repository.js` |

Fluxo:

1. `defaultTenantContext` — define `req.tenantId = 1` em toda request
2. Após `jwtAuth` / `adminAuth`, `tenantContext` resolve tenant do token
3. `tenant_id` enviado pelo cliente é **rejeitado** se divergir do token (quando flag ativa)

## JWT

Tokens cliente passam a incluir `tenant_id`. Admin já incluía desde Fase 3.

## Repositórios com filtro tenant

Quando `MULTI_TENANT_ENABLED=true`:

- `user-repository`: `findByEmail`, `findById`, `create`
- `vehicle-repository`: `findById*`, `create`, `update`, listagens admin
- `invoice-repository`: `findById*`, `listAll`
- `subscription-repository`: `findById`, `create`

## Infraestrutura

- **Redis cache:** `tenant:{id}:tracking:last-position:{vehicleId}` (quando flag ativa)
- **BullMQ:** jobs recebem `tenantId` automaticamente no `enqueue()`
- **WebSocket:** conexões registram `tenantId`; ownership valida tenant
- **Integrações:** `@aguia/integrations` store aceita `tenantId` (default 1)

## Migrations

Executadas no bootstrap da API (após Fase 3):

1. `migrate-tenants-foundation.js`
2. `migrate-aguia-tenant-seed.js`

## Testes

```bash
npm run test:api
```

Suite: `services/api/test/tenant/tenant-isolation.test.js`

## Próxima fase (Fase 2)

- Papéis platform vs tenant
- Isolamento em repositórios restantes (~25)
- Testes de integração com PostgreSQL
- Resolução de tenant por subdomínio

Ver ADR: [`docs/architecture/adr/001-multi-tenant-modular-saas.md`](../architecture/adr/001-multi-tenant-modular-saas.md)
