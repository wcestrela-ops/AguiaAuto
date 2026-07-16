# AG SMS Hub — Guia para Agentes de IA

Este documento orienta assistentes de IA que trabalham no monorepo **AG SMS Hub**, integrado ao repositório Águia Gestão Veicular.

## Visão geral

**AG SMS Hub** é uma plataforma PWA mobile-first para gerenciamento e envio de comandos SMS a rastreadores veiculares. Não é uma plataforma de rastreamento em tempo real.

### Projetos

| Caminho | Pacote | Descrição |
|---------|--------|-----------|
| `services/sms-hub-api/` | `@ag-sms-hub/api` | API REST NestJS + TypeScript |
| `apps/sms-hub-web/` | `@ag-sms-hub/web` | PWA React + Vite + TypeScript |

### Infraestrutura (dev)

| Serviço | Porta host | Compose |
|---------|------------|---------|
| PostgreSQL | 5433 | `docker-compose.sms-hub.yml` |
| Redis | 6380 | `docker-compose.sms-hub.yml` |
| API | 4000 | idem |
| Web | 5174 | idem |

## Princípios obrigatórios

1. **Arquitetura modular** — monólito modular, não microsserviços.
2. **Camadas** — cada módulo: `domain` → `application` → `infrastructure` → `presentation`.
3. **Sem regra de negócio em controllers** — controllers delegam para services.
4. **Isolamento por empresa** — `company_id` vem do JWT, nunca do body para `COMPANY_USER`.
5. **SMS assíncrono** — envios via fila (BullMQ/Redis), nunca na requisição HTTP.
6. **Sem failover automático em dúvida** — status `UNKNOWN` quando não há certeza de aceite.
7. **Credenciais protegidas** — criptografar tokens/senhas; nunca expor na API.
8. **Histórico imutável** — dispatches não são editados/apagados pelo usuário.
9. **Idempotência** — `Idempotency-Key`, locks por dispatch/dispositivo crítico.
10. **Frontend não acessa banco nem gateways** — tudo via API REST.

## Estrutura de módulos (backend)

```
services/sms-hub-api/src/
├── modules/
│   ├── auth/           ✅ Fase 1
│   ├── companies/      🔜 Fase 2
│   ├── users/          🔜 Fase 2
│   ├── catalog/        🔜 Fase 3
│   ├── devices/        🔜 Fase 4
│   ├── dispatches/     🔜 Fase 5
│   ├── gateways/       🔜 Fase 6
│   ├── android-gateway/🔜 Fase 7
│   ├── documents/      🔜
│   ├── audit/          🔜
│   ├── dashboard/      ✅ placeholder Fase 1
│   ├── health/         ✅ Fase 1
│   └── settings/       🔜
└── shared/
    ├── database/
    ├── encryption/
    ├── errors/
    ├── queue/          🔜 Redis/BullMQ
    └── ...
```

## Roles

- `SUPER_ADMIN` — empresas, usuários, biblioteca global, gateways, auditoria.
- `COMPANY_USER` — dados da própria empresa apenas.

## Formato de resposta API

```json
{ "success": true, "data": {}, "meta": null }
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": {},
    "correlation_id": "UUID"
  }
}
```

## Comandos úteis

```bash
# Infra
docker compose -f docker-compose.sms-hub.yml up -d sms-hub-postgres sms-hub-redis

# Dependências (raiz do monorepo)
npm install

# API — dev
npm run dev:sms-hub-api

# Web — dev
npm run dev:sms-hub-web

# Migrations + seed
npm run sms-hub:migration:run
npm run sms-hub:seed

# Testes
npm run test:sms-hub-api
npm run test:sms-hub-web
```

## Variáveis de ambiente

Ver `.env.sms-hub.example`. Prefixo `SMS_HUB_` para a API.

## Ordem de implementação (MVP)

1. ✅ Estrutura, Docker, auth, migrations, seed, login, layout PWA
2. Empresas e usuários (admin CRUD)
3. Permissões e guards de `company_id`
4. Biblioteca (fabricantes, protocolos, modelos, comandos)
5. Dispositivos
6. Prévia e dispatch + fila
7. Gateway FAKE + Gateway Manager
8. Android Gateway
9. SMSMarket
10. Retry/failover seguro, auditoria, testes E2E completos

## Antes de alterar código

1. Leia o prompt mestre do MVP (especificação completa).
2. Analise a estrutura existente — não crie arquitetura paralela.
3. Respeite os módulos e camadas.
4. Atualize OpenAPI (Swagger em `/api/docs`).
5. Adicione/atualize testes relevantes.
6. Documente limitações se entregar parcialmente.

## Credenciais de desenvolvimento (seed)

| Papel | E-mail | Senha padrão |
|-------|--------|--------------|
| Super Admin | admin@agsmshub.local | admin123456 |
| Operador | operador@empresa.local | operador123456 |

Senhas sobrescritas por `SMS_HUB_ADMIN_PASSWORD` e `SMS_HUB_OPERATOR_PASSWORD`.

## Limitações atuais (Fase 1)

- Apenas autenticação e dashboard placeholder
- Sem CRUD de empresas/usuários/dispositivos/comandos
- Sem fila Redis/BullMQ conectada
- Sem gateways (FAKE/ANDROID/SMSMARKET)
- Recuperação de senha retorna 501
- Páginas Dispositivos/Enviar/Histórico/Biblioteca são placeholders

## Integração futura com Águia

O AG SMS Hub é um produto separado neste monorepo. Integração com `@aguia/api` (failover 4G→SMS) será feita em fase posterior, sem misturar regras de negócio entre os dois sistemas.
