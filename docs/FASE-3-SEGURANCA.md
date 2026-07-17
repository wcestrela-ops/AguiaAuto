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
| **Média** | Tokens em localStorage (XSS) | Migração futura para HttpOnly cookies |

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

### Bloco 3.6–3.8 — Em progresso

- LGPD: tabela `lgpd_consents` criada, endpoints pendentes
- CSRF/HttpOnly cookies: pendente (requer mudança frontend)
- Permissões em todas rotas admin: aplicar incrementalmente
- Argon2id: pendente (bcrypt 12 mantido por compatibilidade)

---

## 3. Variáveis de ambiente

```env
ENCRYPTION_KEY=           # 32+ chars — criptografia AES-256-GCM
SESSION_SECRET=           # fallback encryption
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
- [ ] ADMIN_SECRET retorna header de depreciação
- [ ] 2FA obrigatório configurado para superadmin/admin/financeiro
- [ ] Sessões listáveis e revogáveis
- [ ] Webhook Meta rejeita assinatura inválida em produção
- [ ] WebSocket rejeita subscribe de veículo alheio
- [ ] Auditoria registra login/falha login
- [ ] `npm run test:api` passa

---

## 6. Riscos residuais

- Tokens admin ainda em localStorage (XSS)
- bcrypt em vez de Argon2id
- Permissões RBAC não aplicadas em 100% das rotas admin
- Multitenancy preparado (`tenant_id`) mas single-tenant operacional
- Criptografia de integrações requer migração de dados existentes
