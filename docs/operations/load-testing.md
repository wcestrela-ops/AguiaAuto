# Teste de carga — AguiaAuto

Script leve para smoke test de performance em endpoints públicos e health probes.

## Uso

```bash
# API local
node scripts/load-test.js

# Parâmetros
node scripts/load-test.js --url http://localhost:3000 --duration 15 --concurrency 10

# Produção (via Nginx)
node scripts/load-test.js --url https://app.seudominio.com/api --duration 30 --concurrency 20
```

## Endpoints exercitados

| Path | Peso | Motivo |
|------|------|--------|
| `/health/live` | 3 | Liveness — alta frequência |
| `/health/ready` | 2 | Readiness — toca Postgres |
| `/v1/plans` | 1 | Rota pública típica |
| `/v1/openapi.json` | 1 | Spec estática |

## Métricas reportadas

- Total de requisições e taxa de sucesso
- **RPS** (requisições por segundo)
- Latência **p50**, **p95**, **p99** e **max** (ms)

Exit code `1` se taxa de erro > 5%.

## Prometheus

Para correlacionar com métricas reais, ative Prometheus antes do teste:

```env
PROMETHEUS_ENABLED=true
```

Scrape em `GET /metrics` e compare `aguia_http_requests_total` e `aguia_http_request_duration_seconds` com os resultados do script.

## Limitações

- Não substitui ferramentas dedicadas (k6, Locust) para testes de carga completos
- Não exercita rotas autenticadas (admin/cliente)
- Use em staging; evite alta concorrência em produção sem autorização
