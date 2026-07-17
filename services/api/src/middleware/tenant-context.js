const { DEFAULT_TENANT_ID, isMultiTenantEnabled } = require('../lib/tenant/tenant-config');
const { resolveTenantId, validateClientTenantScope } = require('../lib/tenant/tenant-resolver');
const { resolveTenantFromHostHeader } = require('../lib/tenant/tenant-host-resolver');
const { getTenantRepository } = require('../repositories/tenant-repository');

async function defaultTenantContext(req, res, next) {
  let tenantId = DEFAULT_TENANT_ID;
  let tenantSlug = null;
  let source = 'default';

  if (isMultiTenantEnabled() && process.env.DATABASE_URL) {
    try {
      const explicitSlug = req.headers['x-tenant-slug'] || req.headers['x-tenant']
        || req.query?.tenant_slug || req.query?.tenant;
      if (explicitSlug) {
        const tenant = await getTenantRepository().findBySlug(String(explicitSlug).toLowerCase().trim());
        if (tenant && tenant.active !== false) {
          tenantId = tenant.id;
          tenantSlug = tenant.slug;
          source = 'header';
        }
      } else {
        const resolved = await resolveTenantFromHostHeader(req.headers.host, getTenantRepository());
        if (resolved?.tenant && resolved.tenant.active !== false) {
          tenantId = resolved.tenant.id;
          tenantSlug = resolved.tenant.slug;
          source = resolved.source;
        }
      }
    } catch {
      /* fallback para tenant padrão */
    }
  }

  req.tenantId = tenantId;
  req.tenantContext = {
    tenantId,
    tenantSlug,
    source,
  };
  next();
}

function tenantContext(req, res, next) {
  const tenantId = resolveTenantId(req);
  const validation = validateClientTenantScope(req, tenantId);

  if (!validation.ok) {
    return res.status(403).json({
      success: false,
      error: {
        code: validation.code,
        message: validation.message,
        requestId: req.requestId,
      },
    });
  }

  req.tenantId = validation.tenantId;
  req.tenantContext = {
    tenantId: validation.tenantId,
    tenantSlug: req.admin?.tenant_slug || req.user?.tenant_slug || req.tenantContext?.tenantSlug || null,
    userId: req.admin?.id || req.user?.id || null,
    source: req.admin ? 'admin' : req.user ? 'user' : req.tenantContext?.source || 'default',
  };

  return next();
}

module.exports = { defaultTenantContext, tenantContext };
