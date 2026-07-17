const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

class TenantTrackingConfigRepository {
  constructor() {
    this.pool = getPool();
  }

  async get(tenantId = DEFAULT_TENANT_ID) {
    const { rows } = await this.pool.query(
      'SELECT * FROM tenant_tracking_configs WHERE tenant_id = $1',
      [tenantId],
    );
    return rows[0] || {
      tenant_id: tenantId,
      default_provider: 'gpswox',
      sync_strategy: 'PROVIDER_MASTER',
      settings: {},
    };
  }

  async upsert(tenantId, data) {
    const { rows } = await this.pool.query(
      `INSERT INTO tenant_tracking_configs (tenant_id, default_provider, sync_strategy, settings)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (tenant_id) DO UPDATE SET
         default_provider = COALESCE($2, tenant_tracking_configs.default_provider),
         sync_strategy = COALESCE($3, tenant_tracking_configs.sync_strategy),
         settings = COALESCE($4::jsonb, tenant_tracking_configs.settings),
         updated_at = NOW()
       RETURNING *`,
      [
        tenantId,
        data.default_provider || null,
        data.sync_strategy || null,
        data.settings ? JSON.stringify(data.settings) : null,
      ],
    );
    return rows[0];
  }
}

let instance = null;

function getTenantTrackingConfigRepository() {
  if (!instance) instance = new TenantTrackingConfigRepository();
  return instance;
}

module.exports = { TenantTrackingConfigRepository, getTenantTrackingConfigRepository };
