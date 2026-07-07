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
│   └── whatsapp/                  # WhatsApp multi-provedor (Strategy Pattern)
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
| Dashboard | `/admin` |
| Integrações (Firebase, GPSWOX, Asaas) | `/admin/integracoes` |
| Firebase Push | `/admin/integracoes/firebase` |
| WhatsApp Multi-Provedor | `/admin/whatsapp` |
| Veículos (vincular GPSWOX) | `/admin/veiculos` |
| Financeiro (cobranças + provisionamento) | `/admin/financeiro` |
| Alertas (motor + histórico) | `/admin/alertas` |

**Firebase:** configure Project ID, Web API Key, Messaging Sender ID, App ID, VAPID Key e Service Account — tudo pelo painel, nunca no código.

### Auth JWT (Clientes)

| Rota | Descrição |
|------|-----------|
| `POST /v1/auth/register` | Cadastro |
| `POST /v1/auth/login` | Login → access_token + refresh_token |
| `POST /v1/auth/refresh` | Renovar access_token |
| `POST /v1/auth/logout` | Encerrar sessão |
| `GET /v1/auth/me` | Dados do usuário logado |

PWA cliente: `http://localhost:8080/login` · Admin: `http://localhost:8080/admin`

### Meu Veículo (Fase 1)

1. Admin cadastra veículo em `/admin/veiculos` vinculando cliente + `gpswox_device_id`
2. Cliente vê veículos em `/app/veiculos` — **mapa ao vivo** ou **link GPSWOX** para compartilhar
3. Comandos: bloquear, desbloquear, ligar/desligar motor, localizar agora
4. Histórico de rotas no mapa (24h ou 7 dias) via API GPSWOX

| Rota | Descrição |
|------|-----------|
| `GET /v1/veiculos` | Lista veículos do usuário logado |
| `GET /v1/veiculos/:id` | Detalhe do veículo (ownership verificado) |
| `GET /v1/veiculos/:id/localizacao` | Localização via GPSWOX Gateway |
| `POST /v1/veiculos/:id/bloqueio` | Bloquear rastreador |
| `POST /v1/veiculos/:id/desbloqueio` | Desbloquear rastreador |
| `POST /v1/veiculos/:id/comandos/:action` | Comandos: bloquear, desbloquear, ligar, desligar, localizar |
| `GET /v1/veiculos/:id/historico` | Histórico de posições (`?hours=24`) |
| `POST /v1/veiculos/:id/compartilhar` | Link temporário GPSWOX (60 min padrão) |
| `GET /v1/admin/veiculos` | Listar todos (admin) |
| `POST /v1/admin/veiculos` | Criar veículo para cliente |
| `PUT /v1/admin/veiculos/:id` | Atualizar veículo |
| `GET /v1/admin/usuarios` | Listar clientes (admin) |

Rotas `/v1/dashboard`, `/v1/veiculos`, `/v1/perfil` etc. exigem `Authorization: Bearer <access_token>`.

### Financeiro — Asaas + Mercado Pago (Fase 3)

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

### Motor de Alertas (Fase 4)

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

- Cliente cria a senha no cadastro; recebe **e-mail com login e senha**
- Com telefone, também recebe WhatsApp de boas-vindas
- Instaladores criados pelo admin recebem credenciais por e-mail e WhatsApp

```env
SMTP_HOST=smtp.seudominio.com
SMTP_PORT=587
SMTP_FROM=noreply@seudominio.com
```

### Endpoints disponíveis

**API Águia** (`http://localhost:3000`)

| Módulo | Rota | Status |
|--------|------|--------|
| **Auth Cliente** | `POST /v1/auth/login` | ✅ |
| **Auth Cliente** | `POST /v1/auth/register` | ✅ |
| **Auth Cliente** | `POST /v1/auth/refresh` | ✅ |
| **Auth Cliente** | `GET /v1/auth/me` | ✅ |
| Dashboard | `GET /v1/dashboard` | ✅ |
| Meu Veículo | `GET /v1/veiculos` | ✅ |
| Meu Veículo | `GET /v1/veiculos/:id` | ✅ |
| Meu Veículo | `GET /v1/veiculos/:id/localizacao` | ✅ |
| Bloqueio | `POST /v1/veiculos/:id/bloqueio` | ✅ |
| Desbloqueio | `POST /v1/veiculos/:id/desbloqueio` | ✅ |
| Comandos | `POST /v1/veiculos/:id/comandos/:action` | ✅ |
| Histórico | `GET /v1/veiculos/:id/historico` | ✅ |
| Compartilhar GPSWOX | `POST /v1/veiculos/:id/compartilhar` | ✅ |
| Financeiro | `GET /v1/financeiro/resumo` | ✅ |
| Financeiro | `GET /v1/financeiro/faturas` | ✅ |
| Financeiro | `POST /v1/financeiro/segunda-via` | ✅ |
| Planos | `GET /v1/plans` | ✅ |
| Alertas | `GET /v1/alertas` | ✅ |
| Alertas | `PUT /v1/alertas/preferencias` | ✅ |
| Webhooks | `POST /webhooks/asaas` | ✅ |
| Webhooks | `POST /webhooks/mercadopago` | ✅ |
| Webhooks | `POST /webhooks/gpswox` | ✅ |
| **Admin — Integrações** | `GET /v1/admin/integracoes` | ✅ |
| **Admin — Salvar API** | `PUT /v1/admin/integracoes/:key` | ✅ |
| **Admin — Testar API** | `POST /v1/admin/integracoes/:key/test` | ✅ |
| **Admin — Veículos** | `GET/POST/PUT /v1/admin/veiculos` | ✅ |
| **Admin — Usuários** | `GET /v1/admin/usuarios` | ✅ |
| **Admin — Financeiro** | `GET/POST /v1/admin/financeiro/cobrancas` | ✅ |
| **Admin — Provisionar** | `POST /v1/admin/financeiro/reprovisionar/:userId` | ✅ |
| **Admin — Planos** | `GET/POST/PUT /v1/admin/plans` | ✅ |
| **Admin — Alertas** | `GET /v1/admin/alertas` | ✅ |
| Emergência | `GET /v1/emergencia/contatos` | ✅ |
| Onboarding | `POST /v1/onboarding/cadastro` | 🚧 |
| Instalador | `GET /v1/instalador/painel` | ✅ |
| Instalador | `GET /v1/instalador/agendamentos` | ✅ |
| Instalador | `POST /v1/instalador/instalacoes/:id/finalizar` | ✅ |
| **Admin — Instaladores** | `GET/POST /v1/admin/instaladores` | ✅ |
| Contratos | `GET /v1/contratos` | ✅ |
| Contratos | `GET /v1/contratos/status` | ✅ |
| Contratos | `POST /v1/contratos/servico/aceitar` | ✅ |
| Contratos | `POST /v1/contratos/entrega/aceitar` | ✅ |
| Contratos | `GET /v1/contratos/fotos/:id` | ✅ |

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

## Roadmap de implementação

### Fase 1 — Meu Veículo ✅ (atual)
- Tabelas `vehicles`, `plans`, `subscriptions`
- API com ownership (cliente só vê seus veículos)
- Dashboard real com resumo de localização
- Admin: cadastro e vínculo GPSWOX
- PWA: mapa Leaflet, compartilhar GPSWOX, comandos e histórico de rotas

### Fase 2 — Fundação (concluída)
- Monorepo modular
- Gateway GPSWOX (API oficial + Playwright fallback)
- API com módulos estruturados
- Docker Compose com PostgreSQL
- PWA + Auth JWT + Admin + WhatsApp + FCM + Recuperação de senha

### Fase 3 — Financeiro ✅ (atual)
- Integração Asaas + Mercado Pago com failover automático
- PIX em ambos os gateways para mensalidades e adesão
- Mercado Pago: cobrança inicial; Asaas: recorrência
- Admin: gateways configuráveis + cobranças manuais
- PWA: PIX copia e cola no painel do cliente

### Fase 4 — Motor de Alertas ✅ (atual)
- Webhook GPSWOX → **push** para alertas de veículo
- WhatsApp bloqueado em alertas operacionais (anti-ban)
- WhatsApp só: cadastro, cobrança, senha, promoções admin
- Preferências e histórico no PWA

### Fase 5 — Instalador ✅ (atual)
- PWA `/instalador` — painel, agendamentos, histórico e finalização
- Relatório de instalação com até **3 fotos**, duração e descrição do técnico
- Vincula `gpswox_device_id`, ativa veículo e notifica cliente via push
- Admin: `/admin/instaladores` — criar contas com role `installer`
- Tabela `installation_logs` + `installation_photos` para auditoria

### Fase 5b — Contratos e Aceite ✅ (atual)
- PWA `/app/contratos` — contrato de serviço + termos de entrega por veículo
- Cliente aceita que o veículo saiu com rastreador em funcionamento normal
- Aceite registrado em `contract_acceptances` com IP e data
- Fotos servidas com autenticação JWT

### Fase 6 — Extras
- Indique e Ganhe
- Documentos e Manutenção

## Área do Instalador

Fluxo operacional para técnicos de campo:

1. Admin cria conta em `/admin/instaladores` (role `installer`)
2. Instalador faz login em `/login` → redirecionado para `/instalador`
3. Veículos com status `pending_installation` aparecem em **Agendamentos**
4. Ao finalizar, informa `gpswox_device_id` → veículo fica `active` e cliente recebe push

Rotas JWT (`role: installer` ou `admin`):

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/v1/instalador/painel` | Resumo e últimas instalações |
| GET | `/v1/instalador/agendamentos` | Veículos pendentes |
| GET | `/v1/instalador/historico` | Histórico do instalador logado |
| GET | `/v1/instalador/instalacoes/:id` | Detalhe do agendamento |
| POST | `/v1/instalador/instalacoes/:id/finalizar` | Ativa rastreador + relatório (multipart, máx. 3 fotos) |

## Contratos e Termo de Entrega

O cliente acessa `/app/contratos` para:

1. **Contrato de Prestação de Serviços** — aceite único ao utilizar a plataforma
2. **Termo de Entrega** — após cada instalação, com relatório do técnico, fotos e duração

Ao aceitar o termo de entrega, o cliente declara que verificou o relatório e concorda que o veículo (carro ou moto) deixou a instalação com o rastreador em **funcionamento normal**.

**Bloqueio obrigatório:** o cliente só acessa o restante do app (`/app/*`) após aceitar o Contrato de Prestação de Serviços. Até lá, apenas `/app/contratos` fica disponível (API retorna `403 CONTRACT_REQUIRED` nas demais rotas).

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/v1/contratos` | Contrato + entregas pendentes/aceitas |
| POST | `/v1/contratos/servico/aceitar` | Aceitar contrato de serviço |
| POST | `/v1/contratos/entrega/aceitar` | Aceitar termo de entrega (`installation_log_id`) |
| GET | `/v1/contratos/fotos/:id` | Foto do relatório (JWT) |

Fotos ficam em `services/api/uploads/` (configurável via `UPLOAD_DIR`).

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
