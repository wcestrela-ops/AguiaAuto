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
├── Evolution API (WhatsApp)
└── PostgreSQL
```

## Estrutura do monorepo

```
aguia-gestao-veicular/
├── apps/
│   └── web/                       # PWA (Fase 2)
├── services/
│   ├── api/                       # API principal
│   └── gpswox-gateway/            # Gateway interno GPSWOX
├── packages/
│   ├── shared/                    # Constantes compartilhadas
│   └── integrations/              # Configurações de APIs (banco + schemas)
├── docker-compose.yml
└── .env.example
```

## Início rápido

```bash
cp .env.example .env
# Preencha GPSWOX_URL, credenciais e segredos

npm install
docker compose up -d --build
```

### Endpoints disponíveis

**API Águia** (`http://localhost:3000`)

| Módulo | Rota | Status |
|--------|------|--------|
| Health | `GET /health` | ✅ |
| Dashboard | `GET /v1/dashboard` | 🚧 |
| Meu Veículo | `GET /v1/veiculos/:id/localizacao` | ✅ |
| Bloqueio | `POST /v1/veiculos/:id/bloqueio` | ✅ |
| Financeiro | `GET /v1/financeiro/*` | 🚧 |
| Alertas | `GET /v1/alertas/tipos` | ✅ |
| Emergência | `GET /v1/emergencia/contatos` | ✅ |
| Onboarding | `POST /v1/onboarding/cadastro` | 🚧 |
| Instalador | `GET /v1/instalador/*` | 🚧 |
| Webhooks | `POST /webhooks/asaas` | 🚧 |
| **Admin — Integrações** | `GET /v1/admin/integracoes` | ✅ |
| **Admin — Salvar API** | `PUT /v1/admin/integracoes/:key` | ✅ |
| **Admin — Testar API** | `POST /v1/admin/integracoes/:key/test` | ✅ |

## Painel Admin — Configuração de APIs

**Toda API/key é configurada pelo painel admin, não no código.**

As credenciais ficam no PostgreSQL (`integration_configs`). API e Gateway leem do banco automaticamente (cache de 60s). O `.env` serve apenas como bootstrap inicial.

### Integrações disponíveis

| Chave | Serviço |
|-------|---------|
| `gpswox` | Motor de rastreamento |
| `gateway` | Segredo interno do gateway |
| `gateway_client` | Conexão API → Gateway |
| `asaas` | Financeiro |
| `evolution` | WhatsApp |
| `firebase` | Push notifications |

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
| `POST /historico` | 🚧 Em desenvolvimento |
| `POST /cerca` | 🚧 Em desenvolvimento |

## Desenvolvimento local

```bash
npm run dev:api        # API na porta 3000
npm run dev:gateway    # Gateway na porta 3001
npm run diagnostico    # Descobrir seletores GPSWOX
```

## Roadmap de implementação

### Fase 1 — Fundação ✅ (atual)
- Monorepo modular
- Gateway GPSWOX (API oficial + Playwright fallback)
- API com módulos estruturados
- Docker Compose com PostgreSQL

### Fase 2 — PWA
- React + Vite + PWA
- Dashboard e Meu Veículo
- Autenticação JWT
- Mapa em tempo real

### Fase 3 — Financeiro
- Integração Asaas completa
- Webhooks de pagamento
- Cadastro automatizado end-to-end

### Fase 4 — Comunicação
- Firebase Cloud Messaging (push)
- Evolution API (WhatsApp)
- Sistema de alertas configurável

### Fase 5 — Instalador + Extras
- Área do instalador
- Indique e Ganhe
- Documentos e Manutenção

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
