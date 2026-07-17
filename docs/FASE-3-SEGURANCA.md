# Fase 3 — Segurança, Autenticação e Auditoria

Documento de diagnóstico, implementação e operação do AguiaAuto.

## 1. Diagnóstico inicial (Bloco 3.1)

### Arquitetura de autenticação encontrada

| Ator | Mecanismo anterior | Estado Fase 3 |
|------|-------------------|---------------|
| Cliente PWA | JWT access + refresh (DB) | Mantido |
| Instalador | JWT + `role=installer` | Mantido |
| Admin | `ADMIN_SECRET` compartilhado | **Substituído** por login individual + JWT (`aud: aguia-admin`) |
| Webhooks | Verificação parcial por provedor | Reforçado (Meta HMAC, fail-closed prod) |

### Vulnerabilidades críticas identificadas

| Criticidade | Problema | Mitigação |
|-------------|----------|-----------|
| **Crítica** | `ADMIN_SECRET` único em localStorage | Login admin individual + JWT + depreciação do secret |
| **Crítica** | Webhook Meta sem assinatura | Verificação `X-Hub-Signature-256` |
| **Crítica** | Credenciais integrações em JSONB plaintext | Coluna `settings_encrypted` + AES-256-GCM (quando `ENCRYPTION_KEY`) |
| **Alta** | WebSocket subscribe sem ownership | Validação `findByIdForUser` no subscribe |
| **Alta** | Webhooks aceitos sem secret em dev | Fail-closed em produção |
| **Alta** | Auditoria com `X-Admin-User` spoofável | Actor derivado de `req.admin` autenticado |
| **Média** | Senha mínima 6 chars | Política mínima 10 chars + complexidade |
| **Média** | Tokens em localStorage (XSS) | Cookies HttpOnly admin + CSRF; cliente PWA pendente |

### Modelo de usuários

- Tabela `users` com roles: `client`, `installer`, `superadmin`, `admin`, `operator`, `support`, `financeiro`, `supervisor`
- RBAC: `roles`, `permissions`, `role_permissions`, `user_roles`
- Sessões admin em `refresh_tokens.session_type = 'admin'`
- 2FA TOTP via `otplib` + códigos de recuperação

### Rotas sensíveis

- `/v1/admin/*` — painel administrativo
- `/v1/veiculos/:id/bloqueio|desbloqueio` — comandos críticos
- `/webhooks/*` — integrações financeiras e alertas
- `/v1/admin/integracoes/*` — credenciais de terceiros

---

## 2. Implementação por blocos

### Bloco 3.2 — Autenticação ✅ (base)

- `POST /v1/admin/auth/login`
- `POST /v1/admin/auth/refresh`
- `POST /v1/admin/auth/logout`
- `GET /v1/admin/auth/me`
- Bootstrap superadmin via `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD`
- `ADMIN_SECRET` mantido como fallback temporário (header `X-Deprecation-Warning`)

### Bloco 3.3 — Autorização ✅ (base)

- RBAC seed automático
- Middleware `requirePermission()`
- Permissões no JWT admin

### Bloco 3.4 — Segurança reforçada ✅ (parcial)

- 2FA TOTP: setup, verify, disable
- Bloqueio progressivo de login
- PIN transacional (campo + validação service)
- Dashboard `/v1/admin/security/dashboard`

### Bloco 3.5 — Integrações ✅ (parcial)

- Idempotência webhooks (`webhook_events`)
- Meta signature validation
- Criptografia preparada (`ENCRYPTION_KEY`)

### Bloco 3.6–3.8 — Seção 13 ✅

- **Cookies HttpOnly + CSRF (admin):** `aguia_admin_access`, `aguia_admin_refresh` (HttpOnly) e `aguia_csrf` (legível); middleware `csrfProtection` em mutações `/v1/admin/*`
- **RBAC em rotas admin:** middleware `adminRbac` com mapeamento por prefixo (`admin-route-permissions.js`)
- **UI de segurança:** `/admin/seguranca` — dashboard, sessões, tentativas de login, 2FA
- **Credenciais criptografadas:** coluna `settings_encrypted` + `migrateEncryptedSettings()` no bootstrap
- **Endpoints LGPD:** cliente (`/v1/lgpd/export`, `/v1/lgpd/deletion-request`); admin (`/v1/admin/lgpd/consents`, `/v1/admin/lgpd/anonymize/:userId`)
- **Argon2id:** novos hashes com Argon2id; bcrypt legado com rehash progressivo no login

---

## 7. Seção 13 — Cookies, CSRF, RBAC e LGPD

### Cookies administrativos

| Cookie | HttpOnly | Uso |
|--------|----------|-----|
| `aguia_admin_access` | Sim | JWT access admin |
| `aguia_admin_refresh` | Sim | Refresh token admin |
| `aguia_csrf` | Não | Token CSRF (header `X-CSRF-Token`) |

Variáveis:

```env
COOKIE_SECURE=true          # obrigatório em produção HTTPS
COOKIE_DOMAIN=.seudominio.com
CORS_ALLOWED_ORIGINS=https://app.seudominio.com
```

### CSRF

- Aplica-se a `POST`, `PUT`, `PATCH`, `DELETE` em `/v1/admin/*`
- Isento: `/v1/admin/auth/login`, `/refresh`, `/logout`
- Frontend envia `credentials: 'include'` e header `X-CSRF-Token`

### RBAC por prefixo

Rotas `/v1/admin/*` passam por `adminAuth` + `adminRbac`. Permissões mapeadas em `admin-route-permissions.js` (ex.: `security.view`, `vehicles.update`, `integrations.manage`).

### LGPD

| Endpoint | Auth | Descrição |
|----------|------|-----------|
| `GET /v1/lgpd/export` | Cliente JWT | Exportação de dados pessoais |
| `POST /v1/lgpd/deletion-request` | Cliente JWT | Solicitação de exclusão |
| `GET /v1/admin/lgpd/consents` | Admin + `audit.view` | Consentimentos recentes |
| `POST /v1/admin/lgpd/anonymize/:userId` | Admin + `customers.update` | Anonimização |

### Argon2id

- Novos usuários: hash Argon2id (`password-hash.js`)
- Login com bcrypt legado: rehash automático para Argon2id
- Variáveis opcionais: `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM`

### Pendências futuras (pós-seção 13)

- HttpOnly cookies para cliente PWA
- CSRF em rotas cliente
- PIN transacional em comandos veículo
- UI PWA para LGPD/consentimento no cadastro
- CI gitleaks e `.dockerignore`

---

## 3. Variáveis de ambiente

```env
ENCRYPTION_KEY=           # 32+ chars — criptografia AES-256-GCM
SESSION_SECRET=           # fallback encryption
COOKIE_SECURE=true        # cookies admin em HTTPS
COOKIE_DOMAIN=            # opcional, ex: .seudominio.com
CORS_ALLOWED_ORIGINS=     # origens permitidas (vírgula)
TOTP_ISSUER=AguiaAuto
JWT_ACCESS_SECRET=        # opcional, fallback JWT_SECRET
JWT_ACCESS_EXPIRES_IN=1h
JWT_ADMIN_REFRESH_DAYS=1
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCK_TIME=15
PASSWORD_MIN_LENGTH=10
ADMIN_BOOTSTRAP_EMAIL=    # primeiro superadmin
ADMIN_BOOTSTRAP_PASSWORD= # senha forte inicial
WEBHOOK_ALLOW_UNVERIFIED=false
```

---

## 4. Migração do ADMIN_SECRET

1. Defina `ADMIN_BOOTSTRAP_EMAIL` e `ADMIN_BOOTSTRAP_PASSWORD` no `.env`
2. Reinicie a API — superadmin é criado automaticamente se não existir admin
3. Faça login em `/admin/login` com e-mail/senha
4. Configure 2FA em `/v1/admin/auth/2fa/setup`
5. Remova uso do `ADMIN_SECRET` no frontend
6. Após período de transição, remova `ADMIN_SECRET` do `.env`

### Rollback

- Reative `ADMIN_SECRET` no `.env` — fallback legado continua funcional
- Não remova migrações DB (compatíveis)

---

## 5. Checklist de validação

- [ ] Login admin individual funciona
- [ ] Cookies HttpOnly + CSRF em mutações admin
- [ ] ADMIN_SECRET retorna header de depreciação
- [ ] 2FA obrigatório configurado para superadmin/admin/financeiro
- [ ] Sessões listáveis e revogáveis em `/admin/seguranca`
- [ ] RBAC bloqueia rotas sem permissão
- [ ] Webhook Meta rejeita assinatura inválida em produção
- [ ] WebSocket rejeita subscribe de veículo alheio
- [ ] Auditoria registra login/falha login
- [ ] Credenciais integrações em `settings_encrypted` (com ENCRYPTION_KEY)
- [ ] Argon2id aplicado em novos hashes / rehash bcrypt
- [ ] `npm run test:api` passa

---

## 6. Riscos residuais

- Tokens cliente ainda em localStorage (XSS)
- Permissões RBAC por prefixo — rotas atípicas podem precisar `requirePermission` extra
- Multitenancy preparado (`tenant_id`) mas single-tenant operacional
- UI PWA LGPD/consentimento ainda não implementada
