# ADR 001 — Plataforma SaaS modular multi-tenant

| Campo | Valor |
|-------|-------|
| **Status** | Aceito |
| **Data** | 2026-07-17 |
| **Contexto** | Transformação incremental do AguiaAuto em plataforma SaaS multiempresa |
| **Decisores** | Arquitetura de produto / engenharia |

---

## Contexto

O AguiaAuto (Águia Gestão Veicular) é hoje um monorepo funcional com PWA, painel admin, API Express, gateway de rastreamento, financeiro, contratos, WhatsApp, SMS e infraestrutura de filas. Opera como **single-tenant de fato**, embora já exista uma tabela `tenants` mínima e coluna `users.tenant_id` com default `1`.

A meta é permitir que múltiplas empresas de gestão veicular usem a mesma plataforma, contratando módulos de forma independente, com identidade visual própria e integrações próprias ou compartilhadas — **sem recriar o projeto** e **sem quebrar** o tenant Águia em produção.

---

## Decisão

Adotar as seguintes decisões arquiteturais:

### 1. SaaS modular por catálogo de módulos

- Criar catálogo global de módulos (`modules`) e vínculo por empresa (`tenant_modules`).
- Toda rota/feature sensível será protegida por `ModuleAccessService` + middleware `RequireModule(code)`.
- O frontend receberá a lista de módulos ativos, mas **a API é a fonte de verdade** para bloqueio.

### 2. Multi-tenancy por `tenant_id` (banco compartilhado)

- Estratégia: **shared database, shared schema, row-level isolation** via `tenant_id`.
- Não adotar banco por tenant nesta fase (custo operacional e complexidade de deploy no EasyPanel).
- Não adotar schema por tenant (migrations multiplicadas, difícil rollback).

**Justificativa:** o código já usa PostgreSQL centralizado, repositórios com SQL direto e uma tabela `tenants` inicial. A evolução incremental é adicionar `tenant_id` + guards, não reescrever persistência.

### 3. Isolamento lógico obrigatório

- `tenant_id` **nunca** será aceito do cliente como escopo de dados.
- Resolução via: token JWT/sessão, subdomínio, domínio customizado validado, ou integração/webhook mapeada.
- Camada central: `TenantContext`, `TenantResolver`, `TenantMiddleware`, `TenantGuard`.
- Repositórios passam a receber `tenantId` do contexto; queries incluem filtro explícito.
- Redis, filas, WebSocket, arquivos e auditoria usam namespace por tenant.

### 4. Gateways de integração (anti-acoplamento)

- Nenhum módulo de negócio chama GPSWOX, Traccar, Asaas, Evolution, WAHA ou Meta diretamente.
- Padrão existente será formalizado:
  - **Rastreamento:** `TrackingProvider` + `TrackingProviderFactory` (evoluir `gpswox-gateway` + `tracking-platform.js`).
  - **Pagamentos:** `PaymentProvider` (evoluir `payments/payment-gateway-service.js`).
  - **WhatsApp:** `WhatsAppProvider` (já existe em `packages/whatsapp`).
  - **SMS:** `SmsProvider` (já existe em `packages/sms`).

### 5. Integrações SHARED vs OWN_CREDENTIALS

- Cada integração por tenant suportará modo compartilhado (plataforma) ou credencial própria.
- Segredos em repouso criptografados (`settings_encrypted`, `ENCRYPTION_KEY`) — padrão já iniciado em Fase 3.
- UI mascara valores; auditoria registra alterações sem expor tokens.

### 6. Compatibilidade GPSWOX e Traccar

- Manter adapters existentes (`services/gpswox-gateway`, `tracking-platform.js`).
- Estratégia inicial de sync: **PROVIDER_MASTER** (motor externo como fonte de verdade de posição/dispositivo).
- Mapeamento externo via `external_entity_mappings` (a criar na Fase 6).

### 7. Migração incremental e feature flags

- Águia Gestão Veicular = **tenant #1** (`slug: aguia` ou evolução do `default` existente).
- Migration idempotente com dry-run, relatório e backup — **sem apagar dados**.
- Feature flag `MULTI_TENANT_ENABLED=false` até isolamento e testes cruzados estarem verdes.
- Comportamento single-tenant atual permanece até ativação explícita.

### 8. Painel Master separado do Admin de tenant

- Papéis globais (`PLATFORM_SUPER_ADMIN`, etc.) distintos de papéis de empresa (`TENANT_OWNER`, etc.).
- Rotas `/v1/platform/*` (ou `/v1/master/*`) separadas de `/v1/admin/*` do tenant.
- Impersonação/suporte controlada com auditoria obrigatória.

---

## Alternativas consideradas

| Alternativa | Motivo de rejeição |
|-------------|-------------------|
| Banco por tenant | Custo, backup, migrations e EasyPanel complexos para fase inicial |
| Schema por tenant | Mesmos problemas + queries cross-tenant impossíveis para analytics master |
| Rebuild em NestJS/Prisma | Viola regra "não recriar projeto"; alto risco em produção |
| Multitenancy só por subdomínio | Insuficiente para API, webhooks, filas e workers |
| Módulos só no frontend | Inseguro; bypass trivial via API |

---

## Consequências

### Positivas

- Reutiliza ~90% do código existente (auth, financeiro, tracking gateway, filas, PWA).
- Permite vender módulos avulsos e white label sem fork por cliente.
- Isolamento testável com suite de segurança multi-tenant.
- Deploy continua compatível com Docker/EasyPanel atual.

### Negativas / custos

- Toda query existente (~31 repositórios) precisará revisão para `tenant_id`.
- Risco de regressão IDOR se algum endpoint escapar do guard.
- RBAC atual (28 permissões admin) precisa evoluir para papéis platform + tenant.
- `integration_configs` hoje é global — precisa virar por tenant ou híbrido (global + override).
- Cache Redis atual (`tracking:last-position:{vehicleId}`) não isola por tenant.

### Riscos mitigados

| Risco | Mitigação |
|-------|-----------|
| Vazamento cross-tenant | Testes obrigatórios A/B; code review em repositórios; TenantGuard central |
| Quebra do tenant Águia | Migration idempotente; feature flag; default `tenant_id=1` |
| Scope creep | Fases 0–10 com entregáveis verificáveis |
| Performance | Índices `(tenant_id, ...)`; cache namespaced; filas com limite por tenant |

---

## Estado atual relevante (baseline)

Já implementado e será **evoluído**, não substituído:

- Tabela `tenants` (id, name, slug, active) — seed `Default`
- `users.tenant_id`, `audit_logs.tenant_id`
- RBAC admin (`roles`, `permissions`, `role_permissions`, `user_roles`)
- Auth admin individual + cookies HttpOnly + CSRF + 2FA + Argon2id
- Gateway GPSWOX/Traccar, filas BullMQ, cache de posição, WebSocket
- WhatsApp/SMS multi-provedor, Asaas/MP failover
- Criptografia de integrações (`settings_encrypted`)

Ainda **não** implementado:

- Isolamento de queries por tenant
- Catálogo de módulos / assinaturas por tenant
- Painel master da plataforma
- TenantContext / TenantResolver
- `external_entity_mappings`
- White label por domínio
- Testes cross-tenant

---

## Referências

- `docs/saas-transformation-audit.md` — diagnóstico completo Fase 0
- `docs/FASE-3-SEGURANCA.md` — baseline de segurança
- `README.md` — arquitetura e módulos atuais

---

## Próximos passos (Fase 1)

Ver seção "Plano detalhado da Fase 1" em `docs/saas-transformation-audit.md`.
