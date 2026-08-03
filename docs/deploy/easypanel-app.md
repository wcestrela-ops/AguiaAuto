# EasyPanel App (Dockerfile único) — modo simples

Instale o AguiaAuto como **App** no EasyPanel (um container: frontend + API), sem Docker Compose.

## Arquitetura

```text
Internet → EasyPanel (HTTPS) → App :80 (Nginx)
                                ├── /        → React (PWA + admin)
                                ├── /api/*   → Node API :3000 (mesmo container)
                                └── /ws      → WebSocket API

Postgres  → serviço separado no mesmo projeto EasyPanel
Redis     → opcional (serviço separado)
GPSWOX GW → opcional (depois, como 2º app)
```

## Passo a passo

### 1. Postgres no EasyPanel

1. No projeto `aguia` → **Add Service** → **Postgres** (ou PostgreSQL)
2. Anote a **DATABASE_URL** / connection string interna  
   Ex.: `postgresql://postgres:SENHA@aguia_postgres:5432/postgres`  
   (o hostname é o nome do serviço no projeto)

### 2. Criar o App

1. **Add Service** → **App** (não Compose)
2. Source: Git → `wcestrela-ops/AguiaAuto` → branch `main`
3. Configure:

| Campo | Valor |
|-------|--------|
| **Dockerfile** | `Dockerfile` (na raiz do repo) |
| **Porta** | `80` |
| **Build context** | `.` (raiz) |

> Se o EasyPanel pedir `dockerfile` em minúsculo, no campo **Dockerfile path** coloque exatamente `Dockerfile`.

### 3. Environment

Cole as variáveis de [`.env.easypanel-app.example`](../../.env.easypanel-app.example).

Mínimo obrigatório:

```env
DATABASE_URL=postgresql://...   # do Postgres do passo 1
JWT_SECRET=...                  # openssl rand -hex 32
ENCRYPTION_KEY=...
SESSION_SECRET=...
CORS_ORIGIN=https://gestao.aguiaon.com
ADMIN_BOOTSTRAP_EMAIL=admin@aguiaon.com
ADMIN_BOOTSTRAP_PASSWORD=SenhaForteMin10!
ENABLE_INLINE_POLLERS=true
```

Gere segredos:

```bash
openssl rand -hex 32
```

### 4. Domínio

1. No App → Domains → `gestao.aguiaon.com`
2. HTTPS ON
3. Destino: este App, porta **80**, caminho `/`

### 5. Deploy

1. **Deploy** / **Rebuild**
2. Aguarde o build (primeira vez demora)
3. Teste:

```bash
curl -s https://gestao.aguiaon.com/api/health/live
curl -s https://gestao.aguiaon.com/api/health/ready
```

4. Admin: `https://gestao.aguiaon.com/admin/login`

---

## O que este modo inclui

| Item | Status |
|------|--------|
| Frontend (PWA + admin + platform) | ✅ |
| API + migrations + bootstrap admin | ✅ |
| Pollers inline (sem worker separado) | ✅ |
| Postgres externo (EasyPanel) | ✅ necessário |
| Redis | ⚪ opcional |
| GPSWOX Gateway | ⚪ depois (2º app) |
| Worker / Scheduler separados | ⚪ use Compose completo se precisar |

Para stack completa (gateway + worker + scheduler + redis no compose): veja [`easypanel.md`](easypanel.md).

---

## Troubleshooting

| Erro | Solução |
|------|---------|
| `open dockerfile: no such file` | Path = `Dockerfile` (raiz), tipo **App** |
| `DATABASE_URL é obrigatória` | Crie Postgres e cole a URL no Environment |
| `api entered FATAL` / exit status 1 | Veja logs `[api]` / `[entrypoint]`; confira `DATABASE_URL` (host interno) e `API_PORT=3000` |
| `Postgres não respondeu` | Postgres Up? Hostname = nome do serviço (ex. `aguia_postgres`) |
| `port 3000 already allocated` | App na porta **80**, não 3000 |
| 502 / health fail | Logs do App; Postgres healthy? |
| CORS | `CORS_ORIGIN=https://gestao.aguiaon.com` (sem `/`) |

---

## Atualizar

Push em `main` → no EasyPanel **Redeploy** / **Rebuild** do App.
