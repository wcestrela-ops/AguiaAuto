const { getUsageMeteringService } = require('../services/usage-metering-service');
const { isMultiTenantEnabled } = require('../lib/tenant/tenant-config');

function requireUsageLimit(metricKey, { increment = 1 } = {}) {
  return async (req, res, next) => {
    if (!isMultiTenantEnabled()) return next();
    if (!metricKey) return next();

    try {
      await getUsageMeteringService().assertWithinLimit(req.tenantId, metricKey, increment);
      return next();
    } catch (err) {
      if (err.code === 'USAGE_LIMIT_EXCEEDED') {
        return res.status(429).json({
          success: false,
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
            requestId: req.requestId,
          },
        });
      }
      if (err.code === 'SAAS_SUBSCRIPTION_INACTIVE') {
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

module.exports = { requireUsageLimit };
