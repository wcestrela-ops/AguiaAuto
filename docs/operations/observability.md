# Observabilidade — AguiaAuto

## Prometheus

| Variável | Default | Descrição |
|----------|---------|-----------|
| `PROMETHEUS_ENABLED` | `false` | Expõe `GET /metrics` |

Métricas principais:
- `aguia_http_requests_total{method,route,status,tenant_id}`
- `aguia_http_request_duration_seconds_*`

## Sentry

| Variável | Descrição |
|----------|-----------|
| `SENTRY_DSN` | DSN do projeto Sentry (opcional) |
| `SENTRY_ENVIRONMENT` | `production`, `staging`, etc. |
| `SENTRY_RELEASE` | Versão/release (ex. `aguia-api@0.1.0`) |
| `SENTRY_TRACES_SAMPLE_RATE` | Amostragem de traces (default `0.1`) |

Erros HTTP 5xx são capturados automaticamente pelo `errorHandler`. Headers sensíveis (`Authorization`, cookies) são removidos antes do envio.

## Grafana

Dashboard de referência: [`grafana/aguia-api-dashboard.json`](grafana/aguia-api-dashboard.json)

### Importar

1. Grafana → Dashboards → Import
2. Upload do JSON ou cole o conteúdo
3. Selecione datasource **Prometheus** apontando para `/metrics`

### Painéis incluídos

- Taxa de requisições HTTP (`rate(aguia_http_requests_total[5m])`)
- Latência p95 por rota
- Erros 5xx por minuto
- Uptime do processo

## Health probes

| Probe | Rota |
|-------|------|
| Liveness | `GET /health/live` |
| Readiness | `GET /health/ready` |

Ver também: [`runbook.md`](runbook.md)
