const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

const ACTIVE_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE'];

class TenantSaasSubscriptionRepository {
  constructor() {
    this.pool = getPool();
  }

  async findActiveByTenant(tenantId = DEFAULT_TENANT_ID) {
    const { rows } = await this.pool.query(
      `SELECT ts.*, sp.code AS plan_code, sp.name AS plan_name
       FROM tenant_saas_subscriptions ts
       LEFT JOIN saas_plans sp ON sp.id = ts.plan_id
       WHERE ts.tenant_id = $1 AND ts.status = ANY($2::text[])
       ORDER BY ts.created_at DESC
       LIMIT 1`,
      [tenantId, ACTIVE_STATUSES],
    );
    return rows[0] || null;
  }

  async create(data) {
    await this.pool.query(
      `UPDATE tenant_saas_subscriptions SET status = 'CANCELED', canceled_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND status = ANY($2::text[])`,
      [data.tenant_id, ACTIVE_STATUSES],
    );

    const trialDays = data.trial_days ?? 0;
    const trialEnds = trialDays > 0 ? new Date(Date.now() + trialDays * 86400000) : null;
    const status = trialEnds ? 'TRIAL' : (data.status || 'ACTIVE');

    const { rows } = await this.pool.query(
      `INSERT INTO tenant_saas_subscriptions (
        tenant_id, plan_id, provider, provider_subscription_id, status, billing_cycle,
        current_period_start, current_period_end, trial_ends_at
      ) VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8)
      RETURNING *`,
      [
        data.tenant_id,
        data.plan_id,
        data.provider || 'manual',
        data.provider_subscription_id || null,
        status,
        data.billing_cycle || 'MONTHLY',
        data.current_period_end || null,
        trialEnds,
      ],
    );
    return rows[0];
  }

  async updateStatus(id, status) {
    const { rows } = await this.pool.query(
      `UPDATE tenant_saas_subscriptions SET
        status = $2,
        canceled_at = CASE WHEN $2 IN ('CANCELED', 'SUSPENDED') THEN NOW() ELSE canceled_at END,
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, status],
    );
    return rows[0] || null;
  }

  async listByTenant(tenantId) {
    const { rows } = await this.pool.query(
      `SELECT ts.*, sp.code AS plan_code, sp.name AS plan_name
       FROM tenant_saas_subscriptions ts
       LEFT JOIN saas_plans sp ON sp.id = ts.plan_id
       WHERE ts.tenant_id = $1
       ORDER BY ts.created_at DESC`,
      [tenantId],
    );
    return rows;
  }
}

let instance = null;

function getTenantSaasSubscriptionRepository() {
  if (!instance) instance = new TenantSaasSubscriptionRepository();
  return instance;
}

module.exports = { TenantSaasSubscriptionRepository, getTenantSaasSubscriptionRepository, ACTIVE_STATUSES };
