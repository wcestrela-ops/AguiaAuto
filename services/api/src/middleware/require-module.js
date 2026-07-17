const { getModuleAccessService } = require('../services/module-access-service');
const { resolveModuleForPath } = require('../lib/modules/route-modules');

function requireModule(moduleCode) {
  return async (req, res, next) => {
    try {
      const code = moduleCode || resolveModuleForPath(req.method, req.path);
      if (!code) return next();

      await getModuleAccessService().assertActive(req.tenantId, code);
      return next();
    } catch (err) {
      if (err.code === 'MODULE_NOT_ACTIVE' || err.code === 'SAAS_SUBSCRIPTION_INACTIVE') {
        return res.status(403).json({
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
  };
}

module.exports = { requireModule };
