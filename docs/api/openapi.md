# OpenAPI — Águia Gestão Veicular

Especificação REST da API AguiaAuto.

## Acesso

| Ambiente | URL |
|----------|-----|
| Local | `http://localhost:3000/v1/openapi.json` |
| Produção | `https://<dominio>/api/v1/openapi.json` |

Arquivo fonte no repositório: [`services/api/openapi/spec.json`](../../services/api/openapi/spec.json)

## Importar no Postman / Insomnia

1. **Import** → **Link**
2. Cole a URL `/v1/openapi.json`
3. Autenticação admin: cookies `admin_access` + header `X-CSRF-Token` em POST/PUT/PATCH/DELETE
4. Autenticação cliente: `Authorization: Bearer <jwt>`

## Tags principais

| Tag | Escopo |
|-----|--------|
| `Health` | `/health`, `/health/live`, `/health/ready` |
| `Observability` | `/metrics`, `/v1/openapi.json` |
| `Platform` | Painel master SaaS (`/v1/platform/*`) |
| `Admin` | Operação tenant (`/v1/admin/*`) |
| `Client` | PWA cliente autenticado |
| `Webhooks` | Asaas, GPSWOX, Mercado Pago |

## Escopo

A spec documenta os **contratos principais** (health, auth, platform, onboarding B2B, admin SaaS, webhooks). Rotas admin detalhadas (veículos, financeiro, SMS…) seguem o mesmo padrão `{ success, data | error }` documentado nos schemas `Success` e `Error`.

Para lista completa de rotas em runtime, consulte [`README.md`](../../README.md) ou o código em `services/api/src/modules/`.

## Atualização

Ao adicionar rotas platform ou contratos públicos relevantes, atualize `services/api/openapi/spec.json` e valide:

```bash
npm run test:api -- --test-name-pattern=OpenAPI
```
