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

Endpoints implementados na Fase 1:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/forgot-password` (501 — não implementado)
- `POST /api/v1/auth/reset-password` (501 — não implementado)
- `GET /api/v1/dashboard`
- `GET /api/v1/health`

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

- Sem CRUD de empresas, usuários, biblioteca, dispositivos ou gateways
- Sem envio real de SMS
- Redis presente no Docker mas fila ainda não conectada
- Páginas além de Login/Início são placeholders
- Recuperação de senha não implementada

## Próxima entrega recomendada

1. Módulos **companies** e **users** com CRUD admin
2. Guards de autorização e isolamento `company_id`
3. Seed expandido (fabricante Joker, protocolo GT06, comandos de exemplo)
4. Conexão Redis + BullMQ para jobs assíncronos

## Referência

Especificação completa do MVP: prompt mestre AG SMS Hub (seções 1–67).

Para agentes de IA: consulte também `AGENTS.md` na raiz do repositório.
