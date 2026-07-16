# Águia Gestão Veicular

Plataforma SaaS completa de gestão veicular. O GPSWOX é utilizado apenas como **motor de rastreamento interno** — o cliente final nunca acessa o GPSWOX diretamente.

## Arquitetura

```
Cliente (PWA / Android / iOS)
        ↓
API Águia Gestão Veicular          ← services/api
        ↓
Integrações
├── GPSWOX Gateway                 ← services/gpswox-gateway
├── Asaas (financeiro)
├── Firebase (push)
├── WhatsAppService (multi-provedor) ← packages/whatsapp
├── SmsService (rastreador + alertas) ← packages/sms
└── PostgreSQL
```

## Estrutura do monorepo

```
aguia-gestao-veicular/
├── apps/
│   └── web/                       # PWA + Painel Admin
├── services/
│   ├── api/                       # API principal
│   └── gpswox-gateway/            # Gateway interno GPSWOX
├── packages/
│   ├── shared/                    # Constantes compartilhadas
│   ├── integrations/              # Configurações de APIs (banco + schemas)
│   ├── whatsapp/                  # WhatsApp multi-provedor (Strategy Pattern)
│   └── sms/                       # SMS rastreador + alertas (interno)
├── docker-compose.yml
└── .env.example
```

## Início rápido

```bash
cp .env.example .env
# Preencha GPSWOX_URL, credenciais e segredos

npm install
docker compose up -d --build
# Painel admin: http://localhost:8080/admin
# API: http://localhost:3000
```

### Painel Admin (PWA)

Acesse `http://localhost:8080/admin` e use o `ADMIN_SECRET` como token.

| Tela | Caminho |
|------|---------|
| Dashboard operacional | `/admin` |
| Integrações (Firebase, GPSWOX, Asaas, SMTP…) | `/admin/integracoes` |
| WhatsApp multi-provedor | `/admin/whatsapp` |
| SMS Rastreador (comandos + gateways) | `/admin/sms` |
| Veículos (GPSWOX, chip SIM, sync, filtros, instalador) | `/admin/veiculos` |
| Clientes (painel, ficha, exportação) | `/admin/clientes` |
| Financeiro (cobranças, provisionamento, lembretes) | `/admin/financeiro` |
| Planos de assinatura | `/admin/planos` |
| Landing page (conteúdo público) | `/admin/site` |
| Alertas (motor + histórico + promoções) | `/admin/alertas` |
| Emergência (SOS) | `/admin/emergencia` |
| Instaladores | `/admin/instaladores` |
| Contratos (templates + aceites) | `/admin/contratos` |
| Documentos e manutenção (frota) | `/admin/frota` |
| Indique e Ganhe | `/admin/indicacoes` |
| Auditoria administrativa | `/admin/auditoria` |

**Exportação:** nas telas de Clientes, Veículos, Financeiro, Frota, Emergência, SMS e Auditoria há botões **Excel/PDF** (`GET /v1/admin/export/:resource?format=xlsx|pdf`).

**Firebase:** configure Project ID, Web API Key, Messaging Sender ID, App ID, VAPID Key e Service Account — tudo pelo painel, nunca no código.

### PWA Cliente

| Tela | Caminho |
|------|---------|
| Login / cadastro | `/login` · `/cadastro` |
| Início | `/app` |
| Meus veículos (mapa, comandos, âncora) | `/app/veiculos` |
| Financeiro (PIX) | `/app/financeiro` |
| Contratos e aceite de instalação | `/app/contratos` |
| Documentos e manutenção | `/app/frota` |
| Emergência (SOS) | `/app/emergencia` |
| Alertas | `/app/alertas` |
| Perfil e indicações | `/app/perfil` |

**Bloqueio por contrato:** até aceitar o Contrato de Prestação de Serviços, só `/app/contratos` fica liberado. Demais rotas da API retornam `403 CONTRACT_REQUIRED`; o PWA intercepta globalmente e redireciona para Contratos.

### Área do Instalador

| Tela | Caminho |
|------|---------|
| Painel | `/instalador` |
| Agendamentos | `/instalador/agendamentos` |
| Checklist de instalação | `/instalador/instalacoes/:id` |
| Histórico | `/instalador/historico` |

### Auth JWT (Clientes)

| Rota | Descrição |
|------|-----------|
| `POST /v1/auth/register` | Cadastro |
| `POST /v1/auth/login` | Login → access_token + refresh_token |
| `POST /v1/auth/refresh` | Renovar access_token |
| `POST /v1/auth/logout` | Encerrar sessão |
| `GET /v1/auth/me` | Dados do usuário logado |

PWA cliente: `http://localhost:8080/login` · Cadastro: `/cadastro` · Landing: `/` · Admin: `http://localhost:8080/admin`

### Meu Veículo

1. Admin cadastra veículo em `/admin/veiculos` vinculando cliente — **placa opcional** (veículos novos sem emplacamento)
2. Veículos `pending_installation` podem ficar no **pool** (qualquer instalador) ou ser **atribuídos** a um técnico com agendamento opcional
3. Cliente vê veículos em `/app/veiculos` — **mapa ao vivo**, **link GPSWOX** para compartilhar, **âncora** e histórico de rotas
4. Comandos: bloquear, desbloquear, ligar/desligar motor, localizar — com **failover 4G → SMS** quando o chip SIM está cadastrado
5. Sync GPSWOX manual ou automático importa device_id, chip, IMEI e modelo

| Rota | Descrição |
|------|-----------|
| `GET /v1/veiculos` | Lista veículos do usuário logado |
| `GET /v1/veiculos/:id` | Detalhe do veículo (ownership verificado) |
| `GET /v1/veiculos/:id/localizacao` | Localização via GPSWOX Gateway |
| `GET /v1/veiculos/:id/ancora` | Status da âncora |
| `POST /v1/veiculos/:id/ancora` | Ativar âncora (raio + bloqueio ao sair) |
| `DELETE /v1/veiculos/:id/ancora` | Desativar âncora |
| `POST /v1/veiculos/:id/bloqueio` | Bloquear rastreador |
| `POST /v1/veiculos/:id/desbloqueio` | Desbloquear rastreador |
| `POST /v1/veiculos/:id/comandos/:action` | Comandos: bloquear, desbloquear, ligar, desligar, localizar |
| `GET /v1/veiculos/:id/historico` | Histórico de posições (`?hours=24`) |
| `POST /v1/veiculos/:id/compartilhar` | Link temporário GPSWOX (60 min padrão) |
| `GET /v1/admin/veiculos` | Listar com filtros (`q`, `status`, `user_id`, `issue`, `sort`) + total |
| `POST /v1/admin/veiculos` | Criar veículo para cliente |
| `PUT /v1/admin/veiculos/:id` | Atualizar veículo |
| `PATCH /v1/admin/veiculos/:id/instalador` | Atribuir instalador + agendamento |
| `DELETE /v1/admin/veiculos/:id/instalador` | Remover atribuição (volta ao pool) |
| `POST /v1/admin/veiculos/sync-gpswox` | Sync manual (ou prévia com `dry_run`) |
| `GET /v1/admin/usuarios` | Listar clientes (admin) |
| `GET /v1/admin/usuarios/painel` | Painel de clientes com filtros |
| `GET /v1/admin/dashboard/operations` | Dashboard operacional (KPIs + drill-down) |

Rotas `/v1/dashboard`, `/v1/veiculos`, `/v1/perfil` etc. exigem `Authorization: Bearer <access_token>` **e** contrato de serviço aceito (exceto `/v1/contratos/*`).

### Financeiro — Asaas + Mercado Pago

**Dois gateways com failover automático:**

| Gateway | Uso principal |
|---------|---------------|
| **Mercado Pago** | Adesão inicial (primeira cobrança PIX) |
| **Asaas** | Mensalidades recorrentes (PIX) |

Se o gateway principal falhar, o backup é usado automaticamente. Configure em `/admin/integracoes/payment_gateways`.

**Cadastro automático:** ao registrar com `plan_id`, o sistema:
1. Cria cobrança **inicial** via Mercado Pago (PIX) → fallback Asaas
2. Cria **assinatura recorrente** via Asaas (PIX) → fallback Mercado Pago
3. Cria usuário no **GPSWOX**
4. Envia link/código PIX via WhatsApp

**Admin** (`/admin/financeiro`):
- Criar cobranças avulsas ou de adesão
- Ver gateway usado em cada fatura
- Reprovisionar clientes com falha

**Cliente** (`/app/financeiro`):
- Faturas com código **PIX copia e cola**
- Gateway utilizado (Asaas ou Mercado Pago)

| Integração | Painel admin |
|------------|--------------|
| Asaas | `/admin/integracoes/asaas` |
| Mercado Pago | `/admin/integracoes/mercadopago` |
| Roteamento failover | `/admin/integracoes/payment_gateways` |

| Webhook | URL |
|---------|-----|
| Asaas | `POST /webhooks/asaas` |
| Mercado Pago | `POST /webhooks/mercadopago` |
| GPSWOX (alertas) | `POST /webhooks/gpswox` |

### Motor de Alertas

GPSWOX envia eventos para `POST /webhooks/gpswox`. O motor identifica o veículo e dispara notificações.

**Política anti-ban WhatsApp:** alertas de veículo (ignição, rota, velocidade, cerca, etc.) vão **apenas por push**. WhatsApp é usado somente para:
- Cadastro / boas-vindas
- Cobranças e segunda via
- Recuperação de senha
- Promoções enviadas manualmente pelo admin (`POST /v1/admin/comunicacao/promocao`)

Configure em `/admin/integracoes/alertas`. Cliente vê histórico em `/app/alertas` (push).

Exemplo de payload GPSWOX:
```json
{
  "device_id": "12345",
  "type": "overspeed",
  "message": "Excesso de velocidade",
  "speed": "95 km/h"
}
```

### FCM Token (Push Notifications)

| Rota | Descrição |
|------|-----------|
| `POST /v1/notificacoes/token` | Registrar token FCM do dispositivo |
| `DELETE /v1/notificacoes/token` | Remover token |
| `GET /v1/notificacoes/dispositivos` | Listar dispositivos do usuário |
| `POST /v1/notificacoes/teste` | Enviar push de teste |

Firebase deve estar configurado no painel admin antes de registrar tokens.
Cliente PWA: Perfil → Ativar notificações.

### Recuperação de senha

| Rota | Descrição |
|------|-----------|
| `POST /v1/auth/recuperar-senha/solicitar` | `{ email, channel? }` — envia código de 6 dígitos |
| `POST /v1/auth/recuperar-senha/confirmar` | Redefine senha com código |

**Canais (`channel`):** `both` (padrão), `email` ou `whatsapp`. O **mesmo código** vai para todos os canais escolhidos.

- Sem WhatsApp cadastrado → apenas e-mail
- Com WhatsApp → padrão envia e-mail **e** WhatsApp
- Push como fallback se e-mail/WhatsApp falharem

Fluxo: `/recuperar-senha` → escolher canal → `/recuperar-senha/confirmar`

- Código válido por 10 minutos · máx. 3 solicitações / 15 min
- SMTP em **Integrações → E-mail** · WhatsApp no painel admin

### Cadastro e credenciais

- Cliente cria a senha no cadastro (`/cadastro` ou `POST /v1/onboarding/cadastro`) — recebe **e-mail** e, com telefone, **WhatsApp** de boas-vindas com credenciais
- Instaladores criados pelo admin recebem credenciais por e-mail e WhatsApp
- Cadastro online aceita plano, veículo (placa opcional), contrato e provisionamento automático (GPSWOX + Asaas/Mercado Pago)

```env
SMTP_HOST=smtp.seudominio.com
SMTP_PORT=587
SMTP_FROM=noreply@seudominio.com
```

### Endpoints principais

**API Águia** (`http://localhost:3000`)

| Módulo | Rotas | Status |
|--------|-------|--------|
| **Auth** | `POST /v1/auth/login`, `register`, `refresh`, `logout`, `GET /me` | ✅ |
| **Auth** | `POST /v1/auth/recuperar-senha/solicitar`, `confirmar` | ✅ |
| **Onboarding** | `GET /v1/onboarding`, `POST /v1/onboarding/cadastro` | ✅ |
| **Planos (público)** | `GET /v1/plans` | ✅ |
| **Site (público)** | `GET /v1/site/landing` | ✅ |
| **Dashboard cliente** | `GET /v1/dashboard` | ✅ |
| **Veículos** | CRUD cliente + comandos + âncora + histórico + compartilhar | ✅ |
| **Financeiro** | `resumo`, `faturas`, `mensalidades`, `segunda-via` | ✅ |
| **Alertas** | `GET /v1/alertas`, `PUT /preferencias` | ✅ |
| **Frota** | documentos + manutenção (cliente edita os próprios registros) | ✅ |
| **Emergência** | contatos + `POST /acionar` (SOS) | ✅ |
| **Indicações** | `resumo`, `link` + validação pública do código | ✅ |
| **Contratos** | overview, status, aceite serviço/entrega, fotos, download | ✅ |
| **Notificações** | FCM token, dispositivos, teste push | ✅ |
| **Instalador** | painel, agendamentos, histórico, finalizar instalação | ✅ |
| **Admin — Integrações** | CRUD + teste + reload | ✅ |
| **Admin — WhatsApp / SMS** | provedores, failover, comandos rastreador | ✅ |
| **Admin — Veículos** | CRUD, filtros, sync GPSWOX, atribuição instalador | ✅ |
| **Admin — Clientes** | painel, ficha, resumo | ✅ |
| **Admin — Financeiro** | cobranças, baixa manual, provisionar, notificações | ✅ |
| **Admin — Planos / Site** | CRUD planos + landing editável | ✅ |
| **Admin — Frota** | documentos, manutenção, lembretes (push/WhatsApp/SMS) | ✅ |
| **Admin — Dashboard** | `GET /v1/admin/dashboard/operations` | ✅ |
| **Admin — Exportação** | `GET /v1/admin/export/:resource?format=xlsx\|pdf` | ✅ |
| **Admin — Auditoria** | `GET /v1/admin/audit` | ✅ |
| **Webhooks** | Asaas, Mercado Pago, GPSWOX, Meta WhatsApp | ✅ |

## Painel Admin — Configuração de APIs

**Toda API/key é configurada pelo painel admin, não no código.**

As credenciais ficam no PostgreSQL (`integration_configs`). API e Gateway leem do banco automaticamente (cache de 60s). O `.env` serve apenas como bootstrap inicial.

### Integrações disponíveis

| Chave | Serviço |
|-------|---------|
| `gpswox` | Motor de rastreamento |
| `gateway` | Segredo interno do gateway |
| `gateway_client` | Conexão API → Gateway |
| `asaas` | Financeiro recorrente |
| `mercadopago` | Pagamento inicial PIX |
| `payment_gateways` | Failover entre gateways |
| `alertas` | Motor GPSWOX → push/WhatsApp |
| `firebase` | Push notifications |
| `smtp` | E-mail transacional (cadastro, senha) |

> **WhatsApp** usa módulo dedicado em `/v1/admin/whatsapp` (Evolution, WAHA, Meta Cloud).

## WhatsApp Multi-Provedor

Nenhum módulo acessa WhatsApp diretamente — tudo passa pelo **WhatsAppService**.

```
Sistema → WhatsAppService → Provider (Evolution | WAHA | Meta Cloud)
```

### Provedores suportados

| Tipo | Provider |
|------|----------|
| `evolution` | Evolution API |
| `waha` | WAHA (WhatsApp HTTP API) |
| `meta_cloud` | Meta Cloud API (oficial) |

### Painel Admin — Configurações → Integrações → WhatsApp

```bash
# Listar provedores + principal/backup
curl http://localhost:3000/v1/admin/whatsapp \
  -H "Authorization: Bearer SEU_ADMIN_SECRET"

# Cadastrar Evolution API
curl -X POST http://localhost:3000/v1/admin/whatsapp \
  -H "Authorization: Bearer SEU_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "evolution",
    "base_url": "https://evolution.exemplo.com",
    "api_key": "sua-key",
    "instance": "aguia",
    "enabled": true
  }'

# Definir como principal
curl -X PUT http://localhost:3000/v1/admin/whatsapp/1/primary \
  -H "Authorization: Bearer SEU_ADMIN_SECRET"

# Definir backup (failover automático)
curl -X PUT http://localhost:3000/v1/admin/whatsapp/2/backup \
  -H "Authorization: Bearer SEU_ADMIN_SECRET"

# Testar conexão
curl -X POST http://localhost:3000/v1/admin/whatsapp/1/test \
  -H "Authorization: Bearer SEU_ADMIN_SECRET"

# Enviar mensagem (failover automático se principal falhar)
curl -X POST http://localhost:3000/v1/admin/whatsapp/send \
  -H "Authorization: Bearer SEU_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"text","to":"5585999999999","text":"Olá!"}'
```

### Failover automático

1. Tenta enviar pelo provedor **principal**
2. Se falhar (timeout, auth, offline) → usa o **backup**
3. Registra log em `whatsapp_logs` (provedor, tempo, sucesso/erro)

### Adicionar novo provedor

Crie uma classe em `packages/whatsapp/providers/` implementando `WhatsAppProvider` e registre em `provider-factory.js`.

### Exemplos

```bash
# Listar todas as integrações (com segredos mascarados)
curl http://localhost:3000/v1/admin/integracoes \
  -H "Authorization: Bearer SEU_ADMIN_SECRET"

# Configurar GPSWOX
curl -X PUT http://localhost:3000/v1/admin/integracoes/gpswox \
  -H "Authorization: Bearer SEU_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "url": "https://seu-dominio.gpswox.com",
      "user": "admin@empresa.com",
      "pass": "senha",
      "api_hash": "hash-da-api"
    }
  }'

# Testar conexão
curl -X POST http://localhost:3000/v1/admin/integracoes/gpswox/test \
  -H "Authorization: Bearer SEU_ADMIN_SECRET"

# Recarregar cache
curl -X POST http://localhost:3000/v1/admin/integracoes/reload \
  -H "Authorization: Bearer SEU_ADMIN_SECRET"
```

Para adicionar uma nova API no futuro, basta registrar o schema em `packages/integrations/schemas.js` — o painel admin gera os campos automaticamente.

**Gateway GPSWOX** (`http://gpswox-gateway:3001` — uso interno)

| Endpoint | Descrição |
|----------|-----------|
| `POST /localizacao` | Localização (API oficial → fallback Playwright) |
| `POST /clientes` | Criar cliente no GPSWOX |
| `POST /veiculos` | Criar veículo no GPSWOX |
| `POST /bloqueio` | Bloquear veículo |
| `POST /desbloqueio` | Desbloquear veículo |
| `POST /comandos` | Enviar comando |
| `POST /historico` | Histórico de posições (`device_id`, `from`, `to`) |
| `POST /compartilhar` | Link de compartilhamento GPSWOX |
| `POST /cerca` | 🚧 Em desenvolvimento |

## Desenvolvimento local

```bash
npm run dev:web        # PWA + painel admin na porta 5173
npm run dev:api        # API na porta 3000
npm run dev:gateway    # Gateway na porta 3001
npm run diagnostico    # Descobrir seletores GPSWOX
```

## Testes automatizados

```bash
npm test               # API + PWA (31 testes)
npm run test:api       # Apenas API (node:test)
npm run test:web       # Apenas PWA (vitest + jsdom)
```

| Pacote | Runner | Cobertura inicial |
|--------|--------|-------------------|
| `@aguia/api` | Node.js `node:test` | IMEI/chip, export formatters, atribuição instalador (`formatPendingJob`), bloqueio `CONTRACT_REQUIRED` |
| `@aguia/web` | Vitest | IMEI, status veículo, `CONTRACT_REQUIRED` no client API, `setClientPageError` |

Testes ficam em `services/api/test/` e `apps/web/src/**/*.test.js`. Não exigem PostgreSQL — foco em regras de negócio e utilitários. Para CI, execute `npm test` após `npm install`.

## Roadmap de implementação

Todas as fases abaixo estão **implementadas** na versão atual.

### Fase 1 — Meu Veículo ✅
- Veículos com ownership, placa opcional, sync GPSWOX (manual + automático)
- PWA: mapa Leaflet, compartilhar GPSWOX, comandos 4G/SMS, histórico, âncora

### Fase 2 — Fundação ✅
- Monorepo modular · Gateway GPSWOX (API + Playwright) · Docker Compose
- Auth JWT · Admin · WhatsApp · FCM · Recuperação de senha · Auditoria admin

### Fase 3 — Financeiro ✅
- Asaas + Mercado Pago com failover · PIX · cobranças e provisionamento
- Lembretes automáticos de cobrança (WhatsApp/SMS) · baixa manual no admin

### Fase 4 — Motor de Alertas ✅
- Webhook GPSWOX → push (alertas de veículo sem WhatsApp operacional)
- Preferências e histórico no PWA · promoções manuais via admin

### Fase 5 — Instalador ✅
- PWA `/instalador` — checklist (IMEI, chip, modelo, fotos, relatório)
- **Atribuição de instalador:** pool compartilhado ou técnico designado + agendamento
- Push ao instalador na atribuição · admin em `/admin/instaladores`

### Fase 5b — Contratos e Aceite ✅
- Contrato de serviço + termos de entrega (instalação unificada quando aplicável)
- Bloqueio `CONTRACT_REQUIRED` na API + **tratamento global no PWA**
- Snapshots assinados para download · fotos com JWT

### Fase 6 — Extras ✅
- **Indique e Ganhe** · **Documentos e manutenção** (cliente e admin editam)
- **Lembretes de frota** (push + WhatsApp/SMS) · **Emergência SOS**
- **Painel de clientes** · **Planos + landing editável** · **Exportação Excel/PDF**
- **Dashboard operacional** com drill-down (instalações, faturas, frota, emergências…)

## Área do Instalador

Fluxo operacional para técnicos de campo:

1. Admin cria conta em `/admin/instaladores` (role `installer`)
2. Admin cadastra veículo `pending_installation` e opcionalmente **atribui instalador** + data/hora
3. Instalador faz login em `/login` → redirecionado para `/instalador`
4. **Agendamentos** lista veículos do pool (sem atribuição) + atribuídos ao instalador logado
5. Checklist na finalização: Device ID, IMEI, chip SIM, modelo, fotos (máx. 3), relatório e teste de comunicação
6. Veículo fica `active` · cliente recebe push para aceitar em Contratos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/v1/instalador/painel` | Pendentes visíveis + últimas instalações |
| GET | `/v1/instalador/agendamentos` | Veículos pendentes (pool + atribuídos) |
| GET | `/v1/instalador/modelos-rastreador` | Biblioteca de modelos/comandos SMS |
| GET | `/v1/instalador/historico` | Histórico do instalador logado |
| GET | `/v1/instalador/instalacoes/:id` | Detalhe do agendamento |
| POST | `/v1/instalador/instalacoes/:id/finalizar` | Ativa rastreador + relatório (multipart) |
| PATCH | `/v1/admin/veiculos/:id/instalador` | Atribuir instalador (admin) |
| DELETE | `/v1/admin/veiculos/:id/instalador` | Remover atribuição (admin) |

## Contratos e Termo de Entrega

O cliente acessa `/app/contratos` para:

1. **Contrato de Prestação de Serviços** — aceite único ao utilizar a plataforma
2. **Termo de Entrega** — após cada instalação, com relatório do técnico, fotos e duração

Ao aceitar o termo de entrega, o cliente declara que verificou o relatório e concorda que o veículo (carro ou moto) deixou a instalação com o rastreador em **funcionamento normal**.

**Bloqueio obrigatório:** o cliente só acessa o restante do app (`/app/*`) após aceitar o Contrato de Prestação de Serviços. Até lá, apenas `/app/contratos` fica disponível.

- API: `403` com `error: "CONTRACT_REQUIRED"` nas rotas protegidas por `requireServiceContract`
- PWA: interceptação global em `api/client.js` — invalida cache local, redireciona para `/app/contratos` e exibe banner explicativo

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/v1/contratos/status` | Status do aceite (sem exigir contrato prévio) |
| GET | `/v1/contratos` | Contrato + entregas pendentes/aceitas |
| POST | `/v1/contratos/servico/aceitar` | Aceitar contrato de serviço |
| POST | `/v1/contratos/entrega/aceitar` | Aceitar termo de entrega (`installation_log_id`) |
| GET | `/v1/contratos/documento` | Download HTML assinado |
| GET | `/v1/contratos/fotos/:id` | Foto do relatório (JWT) |

Fotos ficam em `services/api/uploads/` (configurável via `UPLOAD_DIR`).

## Documentos, manutenção e lembretes

- **Cliente** (`/app/frota`): CRLV, seguro, IPVA, revisões — cadastro, edição e anexos
- **Admin** (`/admin/frota`): visão global, edição, visualização de anexos, execução manual de lembretes
- **Lembretes automáticos** (pollers): push + WhatsApp/SMS para documentos vencendo/vencidos e manutenções próximas/atrasadas
- Indicadores aparecem no dashboard operacional admin

## Exportação admin (Excel / PDF)

`GET /v1/admin/export/:resource?format=xlsx|pdf`

| Recurso | Descrição |
|---------|-----------|
| `clientes` | Lista de clientes (filtros do painel) |
| `cliente` | Ficha completa (`user_id` obrigatório) |
| `veiculos` | Veículos/dispositivos (filtros) |
| `financeiro-cobrancas` | Cobranças |
| `frota-documentos` | Documentos de frota |
| `frota-manutencao` | Manutenções |
| `emergencia` | Eventos SOS |
| `sms-dispatches` | Envios SMS |
| `auditoria` | Log administrativo |

Cada download gera registro em auditoria (`export.download`).

## Pollers em background

Com `DATABASE_URL` configurado, a API inicia automaticamente:

| Poller | Função |
|--------|--------|
| Âncora | Monitora veículos com âncora ativa |
| Indicações | Qualifica indicados e aplica desconto |
| Sync GPSWOX | Importação agendada de dispositivos |
| Lembretes cobrança | WhatsApp/SMS de faturas |
| Lembretes frota | Push/WhatsApp/SMS de documentos e manutenção |

Intervalos configuráveis via variáveis de ambiente (`ANCORA_POLL_MS`, `GPSWOX_SYNC_CHECK_MS`, `BILLING_REMINDER_CHECK_MS`, `FLEET_REMINDER_CHECK_MS`, etc.).

## Filosofia

- GPSWOX é substituível — toda comunicação passa pelo Gateway
- Cliente nunca vê o GPSWOX
- Automação máxima, intervenção humana mínima
- API própria, identidade visual independente
- PWA preparado para compilação Android/iOS

## Configuração GPSWOX

1. Obtenha o `user_api_hash` no painel admin do GPSWOX
2. Configure `GPSWOX_API_HASH` no `.env`
3. A API oficial será usada sempre que possível; Playwright é fallback

Para calibrar seletores Playwright:

```bash
npm run diagnostico
```
