const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const { resolveTenantId, validateClientTenantScope } = require('../lib/tenant/tenant-resolver');

function defaultTenantContext(req, res, next) {
  req.tenantId = DEFAULT_TENANT_ID;
  req.tenantContext = {
    tenantId: DEFAULT_TENANT_ID,
    tenantSlug: null,
    source: 'default',
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
    tenantSlug: req.admin?.tenant_slug || req.user?.tenant_slug || null,
    userId: req.admin?.id || req.user?.id || null,
    source: req.admin ? 'admin' : req.user ? 'user' : 'default',
  };

  return next();
}

module.exports = { defaultTenantContext, tenantContext };
