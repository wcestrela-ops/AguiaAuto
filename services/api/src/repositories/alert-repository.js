const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const {
  sqlAndTenant,
  appendTenantConditions,
  tenantIdForInsert,
} = require('../lib/tenant/repository-tenant');

class AlertRepository {
  constructor() {
    this.pool = getPool();
  }

  async create(data, tenantId = DEFAULT_TENANT_ID) {
    const tid = tenantIdForInsert(data, tenantId);
    const { rows } = await this.pool.query(
      `INSERT INTO alert_events (
        user_id, tenant_id, vehicle_id, alert_type, title, message, source,
        source_event_id, device_id, payload, channels_sent, delivery_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        data.user_id,
        tid,
        data.vehicle_id || null,
        data.alert_type,
        data.title,
        data.message,
        data.source || 'gpswox',
        data.source_event_id || null,
        data.device_id || null,
        data.payload ? JSON.stringify(data.payload) : null,
        JSON.stringify(data.channels_sent || []),
        data.delivery_status || 'pending',
      ]
    );
    return rows[0];
  }

  async findRecentDuplicate({ source, sourceEventId, minutes = 5, tenantId = DEFAULT_TENANT_ID }) {
    if (!sourceEventId) return null;
    const params = [source, sourceEventId, minutes];
    let sql = `SELECT * FROM alert_events
       WHERE source = $1 AND source_event_id = $2
       AND created_at > NOW() - ($3::text || ' minutes')::interval`;
    const tenant = sqlAndTenant(tenantId, 4);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' LIMIT 1';
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async listByUser(userId, { limit = 50, unreadOnly = false, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [userId];
    let sql = `SELECT ae.*, v.plate, v.brand, v.model
       FROM alert_events ae
       LEFT JOIN vehicles v ON v.id = ae.vehicle_id
       WHERE ae.user_id = $1`;
    const tenant = sqlAndTenant(tenantId, 2, { alias: 'ae' });
    sql += tenant.clause;
    params.push(...tenant.params);
    if (unreadOnly) {
      sql += ' AND ae.read_at IS NULL';
    }
    const limitIdx = tenant.nextIndex;
    params.push(limit);
    sql += ` ORDER BY ae.created_at DESC LIMIT $${limitIdx}`;
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listAll({ limit = 100, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [limit];
    const conditions = [];
    let idx = 2;
    idx = appendTenantConditions(conditions, params, idx, tenantId, { alias: 'ae' });
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT ae.*, u.email AS user_email, u.name AS user_name,
              v.plate AS vehicle_plate
       FROM alert_events ae
       JOIN users u ON u.id = ae.user_id
       LEFT JOIN vehicles v ON v.id = ae.vehicle_id
       ${where}
       ORDER BY ae.created_at DESC
       LIMIT $1`,
      params,
    );
    return rows;
  }

  async markRead(id, userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [id, userId];
    let sql = `UPDATE alert_events SET read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND read_at IS NULL`;
    const tenant = sqlAndTenant(tenantId, 3);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' RETURNING *';
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async markAllRead(userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId];
    let sql = `UPDATE alert_events SET read_at = NOW()
       WHERE user_id = $1 AND read_at IS NULL`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    await this.pool.query(sql, params);
  }

  async countUnread(userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId];
    let sql = `SELECT COUNT(*)::int AS count FROM alert_events
       WHERE user_id = $1 AND read_at IS NULL`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0].count;
  }

  async updateDelivery(id, { channels_sent, delivery_status }, tenantId = DEFAULT_TENANT_ID) {
    const params = [id, JSON.stringify(channels_sent), delivery_status];
    let sql = `UPDATE alert_events SET
        channels_sent = COALESCE($2, channels_sent),
        delivery_status = COALESCE($3, delivery_status)
       WHERE id = $1`;
    const tenant = sqlAndTenant(tenantId, 4);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' RETURNING *';
    const { rows } = await this.pool.query(sql, params);
    return rows[0];
  }
}

let instance = null;

function getAlertRepository() {
  if (!instance) instance = new AlertRepository();
  return instance;
}

module.exports = { AlertRepository, getAlertRepository };
