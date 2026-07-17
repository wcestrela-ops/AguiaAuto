const { normalizeTenantId, DEFAULT_TENANT_ID, isMultiTenantEnabled } = require('./tenant-config');

const CLIENT_TENANT_KEYS = ['tenant_id', 'tenantId', 'tenant'];

function extractClientTenantId(req) {
  if (!req) return null;
  for (const key of CLIENT_TENANT_KEYS) {
    if (req.body?.[key] != null) return normalizeTenantId(req.body[key]);
    if (req.query?.[key] != null) return normalizeTenantId(req.query[key]);
    if (req.params?.[key] != null) return normalizeTenantId(req.params[key]);
  }
  return null;
}

function resolveTenantFromAuth(req) {
  if (req.admin?.tenant_id != null) {
    return normalizeTenantId(req.admin.tenant_id);
  }
  if (req.user?.tenant_id != null) {
    return normalizeTenantId(req.user.tenant_id);
  }
  return DEFAULT_TENANT_ID;
}

function resolveTenantId(req) {
  return resolveTenantFromAuth(req);
}

function validateClientTenantScope(req, resolvedTenantId) {
  if (!isMultiTenantEnabled()) return { ok: true, tenantId: resolvedTenantId };

  const clientTenantId = extractClientTenantId(req);
  if (clientTenantId == null) {
    return { ok: true, tenantId: resolvedTenantId };
  }

  if (clientTenantId !== resolvedTenantId) {
    return {
      ok: false,
      code: 'TENANT_SCOPE_MISMATCH',
      message: 'tenant_id informado pelo cliente não corresponde ao contexto autenticado.',
    };
  }

  return { ok: true, tenantId: resolvedTenantId };
}

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'platform', 'localhost']);

function resolveTenantSlugFromHost(hostHeader) {
  if (!hostHeader) return null;
  const host = String(hostHeader).toLowerCase().split(':')[0];
  const parts = host.split('.').filter(Boolean);
  if (parts.length >= 3) {
    const sub = parts[0];
    if (!RESERVED_SUBDOMAINS.has(sub)) return sub;
  }
  if (parts.length === 2 && parts[1] === 'localhost' && !RESERVED_SUBDOMAINS.has(parts[0])) {
    return parts[0];
  }
  return null;
}

function resolveTenantSlugFromRequest(req) {
  const headerSlug = req.headers['x-tenant-slug'] || req.headers['x-tenant'];
  if (headerSlug) return String(headerSlug).toLowerCase().trim();
  if (req.query?.tenant_slug) return String(req.query.tenant_slug).toLowerCase().trim();
  if (req.query?.tenant) return String(req.query.tenant).toLowerCase().trim();
  return resolveTenantSlugFromHost(req.headers.host);
}

module.exports = {
  resolveTenantId,
  resolveTenantFromAuth,
  extractClientTenantId,
  validateClientTenantScope,
  resolveTenantSlugFromHost,
  resolveTenantSlugFromRequest,
};
