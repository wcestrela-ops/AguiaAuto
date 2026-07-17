# Load test autenticado (k6)

Testes de carga com cenários autenticados usando [k6](https://k6.io/).

## Pré-requisitos

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

## Smoke autenticado

Script: [`scripts/k6/auth-smoke.js`](../../scripts/k6/auth-smoke.js)

```bash
# Apenas endpoints públicos (health)
k6 run scripts/k6/auth-smoke.js

# Com login cliente
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e CLIENT_EMAIL=cliente@exemplo.com \
  -e CLIENT_PASSWORD='senha' \
  -e VUS=5 \
  -e DURATION=60s \
  scripts/k6/auth-smoke.js
```

### Endpoints exercitados

| Autenticação | Rotas |
|--------------|-------|
| Público | `GET /health/live` |
| JWT cliente | `GET /v1/dashboard`, `GET /v1/veiculos` |

Respostas `403` (contrato pendente ou módulo inativo) são aceitas no smoke — indicam auth OK.

## Script Node legado

Para carga leve sem k6:

```bash
npm run load-test
npm run load-test -- --url http://localhost:3000 --duration 30 --concurrency 10
```

Ver [`load-testing.md`](load-testing.md).

## npm script

```bash
npm run load-test:k6
```

Requer variáveis `CLIENT_EMAIL` e `CLIENT_PASSWORD` para cenário autenticado completo.
