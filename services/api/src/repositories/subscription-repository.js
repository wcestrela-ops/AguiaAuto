const { getPool } = require('../db/pool');
const { isMultiTenantEnabled, DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const { tenantWhereClause } = require('../lib/tenant/tenant-query');

class SubscriptionRepository {
  constructor() {
    this.pool = getPool();
  }

  async findActiveByUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT s.*, p.name AS plan_name, p.price_monthly, p.description AS plan_description
       FROM subscriptions s
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 AND s.status = 'active'
       ORDER BY s.created_at DESC LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  }

  async findById(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = 'SELECT * FROM subscriptions WHERE id = $1';
    if (isMultiTenantEnabled()) {
      const filter = tenantWhereClause(tenantId, { paramIndex: 2 });
      sql += filter.clause;
      params.push(...filter.params);
    }
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async findByExternalSubscription(provider, externalId) {
    if (!externalId) return null;
    const { rows } = await this.pool.query(
      `SELECT * FROM subscriptions
       WHERE payment_provider = $1 AND external_subscription_id = $2
       LIMIT 1`,
      [provider, String(externalId)],
    );
    return rows[0] || null;
  }

  async create(data) {
    const tenantId = data.tenant_id ?? DEFAULT_TENANT_ID;
    const { rows } = await this.pool.query(
      `INSERT INTO subscriptions (
        user_id, tenant_id, plan_id, vehicle_id, status, asaas_subscription_id,
        mercadopago_subscription_id, external_subscription_id, payment_provider, billing_type
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        data.user_id,
        tenantId,
        data.plan_id,
        data.vehicle_id || null,
        data.status || 'active',
        data.asaas_subscription_id || null,
        data.mercadopago_subscription_id || null,
        data.external_subscription_id || data.asaas_subscription_id || data.mercadopago_subscription_id || null,
        data.payment_provider || 'asaas',
        data.billing_type || 'PIX',
      ]
    );
    return rows[0];
  }

  async update(id, data) {
    const { rows } = await this.pool.query(
      `UPDATE subscriptions SET
        status = COALESCE($2, status),
        asaas_subscription_id = COALESCE($3, asaas_subscription_id),
        billing_type = COALESCE($4, billing_type),
        ends_at = COALESCE($5, ends_at)
       WHERE id = $1 RETURNING *`,
      [id, data.status, data.asaas_subscription_id, data.billing_type, data.ends_at]
    );
    return rows[0] || null;
  }

  async listByUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT s.*, p.name AS plan_name, p.price_monthly
       FROM subscriptions s
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 ORDER BY s.created_at DESC`,
      [userId]
    );
    return rows;
  }
}

let instance = null;

function getSubscriptionRepository() {
  if (!instance) instance = new SubscriptionRepository();
  return instance;
}

module.exports = { SubscriptionRepository, getSubscriptionRepository };
