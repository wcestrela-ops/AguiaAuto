const { getUsageLimitRepository, METRIC_QUERIES } = require('../repositories/usage-limit-repository');
const { getSaasBillingService } = require('./saas-billing-service');
const { isMultiTenantEnabled, DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

class UsageMeteringService {
  constructor() {
    this.limits = getUsageLimitRepository();
  }

  getSupportedMetrics() {
    return Object.keys(METRIC_QUERIES);
  }

  async refreshMetrics(tenantId = DEFAULT_TENANT_ID) {
    return this.limits.measureAll(tenantId);
  }

  async checkLimit(tenantId, metricKey, options = {}) {
    if (!isMultiTenantEnabled()) {
      return { allowed: true, current: null, limit: null, metric: metricKey };
    }

    await getSaasBillingService().assertSubscriptionActive(tenantId);
    return this.limits.checkLimit(tenantId, metricKey, options);
  }

  async assertWithinLimit(tenantId, metricKey, increment = 0) {
    const result = await this.checkLimit(tenantId, metricKey, { increment });
    if (!result.allowed) {
      const err = new Error(
        `Limite de uso atingido para "${metricKey}" (${result.projected}/${result.limit}).`,
      );
      err.code = 'USAGE_LIMIT_EXCEEDED';
      err.statusCode = 429;
      err.details = result;
      throw err;
    }
    return result;
  }

  async getUsageReport(tenantId = DEFAULT_TENANT_ID) {
    return getSaasBillingService().getTenantUsageSummary(tenantId);
  }
}

let instance = null;

function getUsageMeteringService() {
  if (!instance) instance = new UsageMeteringService();
  return instance;
}

module.exports = { UsageMeteringService, getUsageMeteringService };
