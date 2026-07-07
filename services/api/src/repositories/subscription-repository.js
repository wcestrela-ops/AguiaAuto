const { getPool } = require('../db/pool');

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

  async findById(id) {
    const { rows } = await this.pool.query('SELECT * FROM subscriptions WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async create(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO subscriptions (user_id, plan_id, vehicle_id, status, asaas_subscription_id, billing_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        data.user_id,
        data.plan_id,
        data.vehicle_id || null,
        data.status || 'active',
        data.asaas_subscription_id || null,
        data.billing_type || 'UNDEFINED',
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
