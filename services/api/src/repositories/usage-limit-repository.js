const { getPool } = require('../db/pool');
const { DEFAULT_USAGE_LIMITS } = require('../db/migrate-phase4-saas-billing');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

const METRIC_QUERIES = {
  max_users: `SELECT COUNT(*)::int AS count FROM users WHERE tenant_id = $1 AND active = true`,
  max_customers: `SELECT COUNT(*)::int AS count FROM users WHERE tenant_id = $1 AND role = 'client' AND active = true`,
  max_vehicles: `SELECT COUNT(*)::int AS count FROM vehicles WHERE tenant_id = $1`,
  max_trackers: `SELECT COUNT(*)::int AS count FROM vehicles WHERE tenant_id = $1 AND tracker_device_id IS NOT NULL AND TRIM(tracker_device_id) <> ''`,
};

class UsageLimitRepository {
  constructor() {
    this.pool = getPool();
  }

  async getLimits(tenantId = DEFAULT_TENANT_ID) {
    const { rows } = await this.pool.query(
      'SELECT limits FROM tenant_usage_limits WHERE tenant_id = $1',
      [tenantId],
    );
    return { ...(rows[0]?.limits || DEFAULT_USAGE_LIMITS) };
  }

  async setLimits(tenantId, limits) {
    const { rows } = await this.pool.query(
      `INSERT INTO tenant_usage_limits (tenant_id, limits)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (tenant_id) DO UPDATE SET
         limits = $2::jsonb,
         updated_at = NOW()
       RETURNING *`,
      [tenantId, JSON.stringify(limits)],
    );
    return rows[0];
  }

  async measureMetric(tenantId, metricKey) {
    const sql = METRIC_QUERIES[metricKey];
    if (!sql) return null;
    const { rows } = await this.pool.query(sql, [tenantId]);
    return rows[0]?.count ?? 0;
  }

  async measureAll(tenantId = DEFAULT_TENANT_ID) {
    const metrics = {};
    for (const key of Object.keys(METRIC_QUERIES)) {
      metrics[key] = await this.measureMetric(tenantId, key);
    }

    await this.pool.query(
      `INSERT INTO tenant_usage_metrics (tenant_id, metrics, measured_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET
         metrics = $2::jsonb,
         measured_at = NOW(),
         updated_at = NOW()`,
      [tenantId, JSON.stringify(metrics)],
    );

    return metrics;
  }

  async getCachedMetrics(tenantId = DEFAULT_TENANT_ID) {
    const { rows } = await this.pool.query(
      'SELECT metrics, measured_at FROM tenant_usage_metrics WHERE tenant_id = $1',
      [tenantId],
    );
    if (rows[0]) return rows[0];
    const metrics = await this.measureAll(tenantId);
    return { metrics, measured_at: new Date().toISOString() };
  }

  async checkLimit(tenantId, metricKey, { increment = 0 } = {}) {
    const limits = await this.getLimits(tenantId);
    const limit = limits[metricKey];
    if (limit == null || limit < 0) {
      return { allowed: true, current: null, limit: null, metric: metricKey };
    }

    const current = await this.measureMetric(tenantId, metricKey);
    const projected = current + increment;
    return {
      allowed: projected <= limit,
      current,
      projected,
      limit,
      metric: metricKey,
    };
  }
}

let instance = null;

function getUsageLimitRepository() {
  if (!instance) instance = new UsageLimitRepository();
  return instance;
}

module.exports = { UsageLimitRepository, getUsageLimitRepository, METRIC_QUERIES };
