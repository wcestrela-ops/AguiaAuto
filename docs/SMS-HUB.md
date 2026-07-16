# SMS Rastreador (uso interno Águia)

SMS integrado ao monorepo Águia — **mesmo padrão do WhatsApp**. Não há sistema separado, segundo banco ou login extra.

## O que faz

| Função | Onde |
|--------|------|
| Comandos ao rastreador (failover 4G→SMS) | Automático em `vehicle-service` |
| Gateways SMS (simulado, Android, HTTP GPSWOX, SMSMarket) | Admin → **SMS Rastreador** (`/admin/sms`) |
| Chip SIM, IMEI, modelo | Admin → **Veículos** |
| Importar dispositivos GPSWOX | Veículos → **Sincronizar GPSWOX** |
| Cobrança / lembrete | WhatsApp primeiro, **SMS como fallback** |
| Histórico de envios | Admin → SMS Rastreador (últimos dispatches) |

## Instalação

Faz parte do stack unificado — **nada extra**:

```bash
cp .env.example .env
npm install
docker compose up -d --build
```

Na primeira subida da API:
- Tabelas `sms_providers`, `sms_dispatches`, `sms_logs` são criadas automaticamente
- Gateway **simulado** é cadastrado como principal (desenvolvimento)

Configure gateways reais em `/admin/sms` quando for para produção.

## Arquitetura

```
packages/sms/              @aguia/sms (gateways + dispatches)
services/api/
  services/sms.js          facade
  modules/admin/sms/       CRUD gateways
  services/gpswox-sync-service.js   import GPSWOX → veículos
```

## Failover 4G → SMS

1. Cliente envia bloqueio/desbloqueio/localizar
2. API tenta GPSWOX (4G)
3. Se falhar de forma elegível e o veículo tiver `tracker_phone`:
4. `@aguia/sms` envia `RELAY,1#` / `RELAY,0#` / `WHERE#` para o chip

## Sync GPSWOX

```http
POST /v1/admin/veiculos/sync-gpswox
Authorization: Bearer {ADMIN_SECRET}
Content-Type: application/json

{ "dry_run": true }
```

Importa: `gpswox_device_id`, nome, chip SIM, IMEI, modelo. Vincula ao cliente Águia via `users.gpswox_user_id`.

## Gateways Android

Cadastre em `/admin/sms` → **Gateway Android (chip no aparelho)**:
- URL do agente HTTP no smartphone
- Chave API
- ID do dispositivo

O celular envia SMS pelo chip instalado nele.

## Gateway HTTP GPSWOX

Dois sentidos, mesmo padrão de URL (`%NUMBER%`, `%MESSAGE%`):

### Entrada — GPSWOX chama a Águia

Quando o operador envia SMS pelo painel GPSWOX, o GPSWOX faz HTTP GET/POST para a Águia:

```
http://SUA_API/v1/sms/gateway/send?username=USER&password=PASSWORD&number=%NUMBER%&message=%MESSAGE%
```

- Configure usuário/senha em **Integrações → Gateway SMS GPSWOX (entrada)**
- A URL de exemplo aparece em **Admin → SMS Rastreador**
- A Águia repassa o SMS pelo gateway principal configurado em `/admin/sms`

### Saída — Águia chama gateway externo

Cadastre em `/admin/sms` → **Gateway HTTP GPSWOX (SMS/WhatsApp)**:

```
http://SMS_GATEWAY/sendsms.php?username=USER&password=PASSWORD&number=%NUMBER%&message=%MESSAGE%
```

Substitua `USER`/`PASSWORD` pelos campos Usuário e Senha do gateway. Útil para gateways PHP, modems ou serviços compatíveis com GPSWOX.

## Biblioteca de comandos

Tabelas `tracker_models` + `tracker_commands` — editável em `/admin/sms`.

Cada veículo pode ter `tracker_model_id` (admin → Veículos). Comandos SMS e GPSWOX vêm da biblioteca; fallback para padrão GT06.

## Envio manual

Admin → SMS Rastreador → **Enviar SMS**: informe número + mensagem, ou escolha modelo + comando.

API: `POST /v1/admin/sms/send` ou `POST /v1/admin/sms/send-command`

## API admin

| Rota | Descrição |
|------|-----------|
| `GET /v1/admin/sms` | Listar gateways |
| `POST /v1/admin/sms` | Criar gateway |
| `PUT /v1/admin/sms/:id/primary` | Definir principal |
| `POST /v1/admin/sms/:id/test` | Testar conexão |
| `GET /v1/admin/sms/dispatches` | Histórico |
| `POST /v1/admin/sms/send` | Envio manual |
| `GET /v1/sms/gateway/info` | URL exemplo para colar no GPSWOX |
| `GET/POST /v1/sms/gateway/send` | Entrada HTTP do GPSWOX (%NUMBER%, %MESSAGE%) |

Credenciais ficam no **banco Águia** (`sms_providers`), não em variáveis de ambiente.
