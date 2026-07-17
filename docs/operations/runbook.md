# Runbook operacional — AguiaAuto SaaS

Procedimentos para operação, manutenção e troubleshooting em produção (EasyPanel / VPS).

---

## Serviços e responsabilidades

| Processo | Container | Comando | Reiniciar quando |
|----------|-----------|---------|------------------|
| API HTTP | `api` | `node src/server.js` | Deploy, env change |
| Worker filas | `worker` | `node src/worker.js` | Deploy, jobs travados |
| Scheduler | `scheduler` | `node src/scheduler.js` | Deploy |
| Gateway tracking | `gpswox-gateway` | default | Sync GPSWOX/Traccar |
| Frontend | `web` | Nginx | Deploy UI |

Migrations rodam **automaticamente** na subida da API (`server.js` → `bootstrap()`).

---

## Monitoramento

### Endpoints de saúde

```bash
# Liveness — processo responde
curl -s https://<dominio>/api/health/live

# Readiness — Postgres acessível
curl -s https://<dominio>/api/health/ready

# Diagnóstico completo (DB, Redis, gateway, filas)
curl -s https://<dominio>/api/health | jq .
```

| Status | Significado |
|--------|-------------|
| `HEALTHY` | Tudo ok |
| `DEGRADED` | Funciona com limitação (ex.: Redis off, gateway lento) |
| `UNAVAILABLE` | Indisponível — investigar imediatamente |

### Painéis internos

| Tela | URL | Acesso |
|------|-----|--------|
| Dashboard admin | `/admin` | superadmin / admin |
| Ops (filas, WS) | `/admin` dashboard | superadmin |
| Plataforma SaaS | `/platform` | superadmin tenant #1 ou `platform_*` |

### Variáveis opcionais de monitoramento

```env
SENTRY_DSN=https://...
UPTIME_KUMA_PUSH_URL=https://...
PROMETHEUS_ENABLED=false
LOG_LEVEL=info
```

---

## Backup e restore

### Backup automático

Serviço `backup` (profile `backup` no compose):

```bash
docker compose -f docker-compose.prod.yml --profile backup up -d backup
```

Script: `scripts/backup-postgres.sh` — pg_dump diário com retenção configurável.

| Variável | Default | Descrição |
|----------|---------|-----------|
| `RETENTION_DAILY` | 7 | Backups diários |
| `RETENTION_WEEKLY` | 4 | Cópias semanais (domingo) |
| `RETENTION_MONTHLY` | 6 | Cópias mensais (dia 1) |
| `BACKUP_REMOTE_PATH` | — | Cópia adicional opcional |

Marcador Redis: `ops:last-backup` (TTL 7 dias).

### Restore manual

```bash
# Parar worker/scheduler para evitar jobs durante restore
docker compose -f docker-compose.prod.yml stop worker scheduler

gunzip -c /backups/postgres/daily/aguia_YYYYMMDD_HHMMSS.sql.gz | \
  psql "$DATABASE_URL"

docker compose -f docker-compose.prod.yml start worker scheduler
```

---

## Feature flag multi-tenant

```env
MULTI_TENANT_ENABLED=false   # default — Águia single-tenant
MULTI_TENANT_ENABLED=true    # SaaS — isolamento por tenant
```

### Ativar SaaS em produção

1. Garantir migrations Fase 1–8 aplicadas (automático na subida)
2. Rodar testes cross-tenant em staging
3. Alterar `.env` → `MULTI_TENANT_ENABLED=true`
4. Redeploy: restart `api`, `worker`, `scheduler`
5. Validar tenant #1 (Águia) intacto
6. Testar onboarding em `/platform/onboarding`

### Rollback

1. `MULTI_TENANT_ENABLED=false`
2. Redeploy
3. Dados multi-tenant permanecem no banco (não destrutivo)

---

## Operação plataforma SaaS

### Acesso ao painel master

- URL: `/platform`
- Quem acessa: `superadmin` do tenant #1 ou papéis `platform_*`
- Atribuir papel platform via SQL (emergência):

```sql
UPDATE users SET role = 'platform_super_admin' WHERE email = 'ops@empresa.com';
```

### Onboarding nova empresa

1. `/platform/onboarding`
2. Preencher empresa + owner + plano SaaS
3. Anotar senha temporária do owner
4. Owner acessa `/admin/login` e troca senha

### Suspender tenant

`/platform/tenants` → Suspender — status `SUSPENDED`, módulos inativos.

---

## Deploy e atualização

### Checklist pré-deploy

```bash
./scripts/deploy-check.sh .env
npm test
```

### Atualização rolling (EasyPanel)

1. Pull/build novas imagens
2. EasyPanel recria containers na ordem de `depends_on`
3. API roda migrations idempotentes na subida
4. Validar `/api/health/ready`

### Rollback de versão

1. EasyPanel → redeploy commit/tag anterior
2. Migrations são idempotentes (não revertem automaticamente)
3. Se migration nova quebrou, restaurar backup DB + versão anterior

---

## Troubleshooting

### API retorna 503 em /health

```bash
docker logs aguia-api --tail 100
```

| Componente | Verificação |
|------------|-------------|
| `postgres` | `docker logs aguia-postgres`; `pg_isready` |
| `redis` | `redis-cli -u $REDIS_URL ping` |
| `gpswoxGateway` | Logs gateway; credenciais em `/admin/integracoes` |

### Filas BullMQ acumulando

1. Dashboard admin → stats de filas
2. Verificar `worker` rodando: `docker ps | grep worker`
3. Logs: `docker logs aguia-worker --tail 200`
4. Redis memory: `maxmemory 256mb` no compose — aumentar se necessário

### WebSocket desconecta

- Confirmar proxy `/ws` com `Upgrade` headers (Nginx já configurado)
- EasyPanel não deve fazer timeout < 3600s em `/ws`

### Integrações SHARED vs OWN

- Novos tenants: integrações SHARED (credenciais do tenant #1)
- Tenant com credenciais próprias: `/platform/tenants/:id` → modo OWN
- Ver [`docs/multi-tenancy/README.md`](../multi-tenancy/README.md) Fase 7

### CSRF / sessão admin

- Cookies HttpOnly + CSRF token
- `CORS_ORIGIN` deve coincidir com domínio do browser
- Sessão expira: `JWT_ADMIN_REFRESH_DAYS` (default 1 dia)

---

## Logs

API emite JSON estruturado com `requestId`. Buscar por correlation:

```bash
docker logs aguia-api 2>&1 | grep "<requestId>"
```

Sanitização automática de segredos via `sanitizeLogMeta`.

---

## Referências

- Deploy: [`docs/deploy/easypanel.md`](../deploy/easypanel.md)
- Multi-tenancy: [`docs/multi-tenancy/README.md`](../multi-tenancy/README.md)
- Segurança: [`docs/FASE-3-SEGURANCA.md`](../FASE-3-SEGURANCA.md)
- ADR SaaS: [`docs/architecture/adr/001-multi-tenant-modular-saas.md`](../architecture/adr/001-multi-tenant-modular-saas.md)
