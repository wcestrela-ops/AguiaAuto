# Domínio custom — white-label

Guia para apontar um domínio próprio (ex. `gestao.suaempresa.com.br`) para um tenant SaaS.

## Fluxo

1. Admin define `custom_domain` em **Branding** (`PATCH /v1/admin/branding`)
2. DNS do cliente aponta CNAME para o host da plataforma (ex. `app.seudominio.com.br`)
3. Nginx/proxy encaminha `Host` preservado para a API
4. API resolve tenant via `tenants.custom_domain` (Fase 14)
5. Frontend carrega branding via `GET /v1/tenant/branding` (header `Host`)

## DNS (exemplo)

```
gestao.cliente.com.br  CNAME  app.seudominio.com.br
```

## Nginx (trecho)

```nginx
server {
  listen 443 ssl http2;
  server_name gestao.cliente.com.br app.seudominio.com.br *.seudominio.com.br;

  location /api/ {
    proxy_pass http://aguia-api:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://aguia-web:8080;
    proxy_set_header Host $host;
  }
}
```

## Resolução na API

Ordem de prioridade (`MULTI_TENANT_ENABLED=true`):

1. Header `X-Tenant-Slug` / query `tenant_slug`
2. `custom_domain` = host completo da requisição
3. Subdomínio (`empresa.seudominio.com.br` → slug `empresa`)

## Variáveis

```env
MULTI_TENANT_ENABLED=true
VITE_MULTI_TENANT_ENABLED=true
```

## Teste local

```bash
# /etc/hosts
127.0.0.1 gestao.test.local

curl -H "Host: gestao.test.local" http://localhost:3000/v1/tenant/branding
```

Defina `custom_domain = gestao.test.local` no tenant via admin branding.
