# Instalador automático — AguiaAuto

Script interativo que gera `.env`, valida segredos e sobe `docker-compose.prod.yml`.

## Pré-requisitos

- VPS Linux com **Docker** + **Docker Compose** plugin
- Domínio apontando para o IP da VPS (pode configurar DNS depois)
- Repositório clonado na máquina

```bash
git clone https://github.com/wcestrela-ops/AguiaAuto.git
cd AguiaAuto
```

## Instalação rápida (interativa)

```bash
chmod +x scripts/install.sh scripts/deploy-check.sh
./scripts/install.sh
```

O script pergunta:

1. Domínio público (`https://app.suaempresa.com.br`)
2. E-mail e senha do superadmin
3. Senha do Postgres (ou gera automaticamente)
4. Multi-tenant SaaS (`true` / `false`)

Em seguida:

1. Gera `.env` a partir de `.env.production.example`
2. Cria segredos (`JWT_SECRET`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `GATEWAY_SECRET`)
3. Roda `./scripts/deploy-check.sh`
4. Executa `docker compose -f docker-compose.prod.yml up -d --build`
5. Aguarda `/health/ready` na API

## Modo não interativo

```bash
./scripts/install.sh \
  --domain https://app.suaempresa.com.br \
  --admin-email admin@suaempresa.com.br \
  --admin-password 'SenhaForteMin10!' \
  --yes
```

### Opções

| Flag | Descrição |
|------|-----------|
| `--domain URL` | `CORS_ORIGIN` (https recomendado) |
| `--admin-email` | Superadmin bootstrap |
| `--admin-password` | Mínimo 10 caracteres |
| `--postgres-password` | Senha do banco (senão gera) |
| `--multi-tenant true\|false` | Default `false` |
| `--skip-up` | Só gera `.env` + valida |
| `--dry-run` | Gera `.env.install.tmp` sem sobrescrever `.env` |
| `--no-build` | `up -d` sem `--build` |
| `--yes` | Sem confirmação |

## EasyPanel

1. Rode o instalador com `--skip-up` na máquina local (ou na VPS) para gerar o `.env`
2. No EasyPanel: **Docker Compose** → `docker-compose.prod.yml`
3. Cole o conteúdo do `.env` em **Environment**
4. Domínio + HTTPS no serviço `web`
5. Deploy

Guia completo: [`easypanel.md`](easypanel.md)

## Pós-instalação

1. Login: `https://seudominio/admin/login`
2. Altere a senha em **Segurança**
3. Configure integrações em `/admin/integracoes` (GPSWOX, SMTP, Asaas, Firebase…)
4. (SaaS) Com `MULTI_TENANT_ENABLED=true`, acesse `/platform/onboarding`

## Validação manual

```bash
./scripts/deploy-check.sh .env
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml exec api \
  node -e "require('http').get('http://127.0.0.1:3000/health/ready', r => { console.log(r.statusCode); process.exit(r.statusCode===200?0:1) })"
```

Via domínio (após HTTPS):

```bash
curl -s https://seudominio/api/health/live
curl -s https://seudominio/api/health/ready
```

## Troubleshooting

| Sintoma | Ação |
|---------|------|
| `Docker Compose plugin não disponível` | Instale Docker Engine + plugin Compose |
| `deploy-check` falha em placeholders | Regenere com `./scripts/install.sh --yes` |
| Timeout `/health/ready` | `docker compose -f docker-compose.prod.yml logs api` |
| 502 no domínio | API ainda subindo ou proxy sem `/api` |

Operação contínua: [`../operations/runbook.md`](../operations/runbook.md)
