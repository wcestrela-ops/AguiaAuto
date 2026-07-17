const { assertResourceTenant } = require('./tenant-query');

class TenantAccessError extends Error {
  constructor(message = 'Recurso não pertence ao tenant autenticado.', code = 'TENANT_ACCESS_DENIED') {
    super(message);
    this.name = 'TenantAccessError';
    this.code = code;
    this.statusCode = 403;
  }
}

function assertTenantResource(resource, tenantId) {
  if (!assertResourceTenant(resource, tenantId)) {
    throw new TenantAccessError();
  }
  return resource;
}

function tenantGuardHandler(err, req, res, next) {
  if (err instanceof TenantAccessError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        requestId: req.requestId,
      },
    });
  }
  return next(err);
}

module.exports = {
  TenantAccessError,
  assertTenantResource,
  tenantGuardHandler,
};
