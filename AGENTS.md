# AG SMS — Guia para Agentes de IA

SMS de rastreadores **integrado ao Águia** (uso interno). Não é produto separado.

## Pacote

| Caminho | Pacote | Descrição |
|---------|--------|-----------|
| `packages/sms/` | `@aguia/sms` | Gateways SMS + dispatches (padrão `@aguia/whatsapp`) |
| `services/api/src/services/sms.js` | — | Facade para a API |
| `apps/web/src/pages/admin/SmsPage.jsx` | — | Admin gateways |

## Princípios

1. **Um banco** — `sms_providers`, `sms_dispatches`, `sms_logs` no Postgres Águia
2. **Admin configura gateways** — `/v1/admin/sms`, credenciais no banco
3. **Veículo tem o chip** — `vehicles.tracker_phone` (importável do GPSWOX)
4. **Failover in-process** — `vehicle-service` → `@aguia/sms` (sem HTTP externo)
5. **Cobrança** — `billing-notifications.js`: WhatsApp → fallback SMS

## Comandos úteis

```bash
npm install
docker compose up -d --build
npm run dev:api
npm run dev:web
```

## Rotas admin

- `/admin/sms` — gateways SMS
- `/admin/veiculos` — veículos + sync GPSWOX + chip SIM

## Referência

`docs/SMS-HUB.md` — documentação operacional SMS interno.
