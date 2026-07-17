const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const {
  sqlAndTenant,
  appendTenantConditions,
  tenantIdForInsert,
} = require('../lib/tenant/repository-tenant');

class EmergencyEventRepository {
  constructor() {
    this.pool = getPool();
  }

  async create(data, tenantId = DEFAULT_TENANT_ID) {
    const tid = tenantIdForInsert(data, tenantId);
    const { rows } = await this.pool.query(
      `INSERT INTO emergency_events (
        tenant_id, user_id, vehicle_id, message, latitude, longitude, address, channels, notified_count
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        tid,
        data.user_id,
        data.vehicle_id || null,
        data.message || null,
        data.latitude ?? null,
        data.longitude ?? null,
        data.address || null,
        JSON.stringify(data.channels || []),
        data.notified_count || 0,
      ],
    );
    return rows[0];
  }

  async findLatestForUser(userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId];
    let sql = `SELECT * FROM emergency_events
       WHERE user_id = $1`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ` ORDER BY created_at DESC LIMIT 1`;
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async countSince(hours = 24, tenantId = DEFAULT_TENANT_ID) {
    const params = [String(hours)];
    const conditions = [`created_at >= NOW() - ($1 || ' hours')::interval`];
    appendTenantConditions(conditions, params, 2, tenantId);
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM emergency_events WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return rows[0].count;
  }

  async listRecent({ limit = 20, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [Math.min(limit, 100)];
    const conditions = [];
    let idx = 2;
    idx = appendTenantConditions(conditions, params, idx, tenantId, { alias: 'e' });
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT e.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
              v.plate, v.brand, v.model
       FROM emergency_events e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN vehicles v ON v.id = e.vehicle_id
       ${where}
       ORDER BY e.created_at DESC
       LIMIT $1`,
      params,
    );
    return rows;
  }
}

let instance = null;

function getEmergencyEventRepository() {
  if (!instance) instance = new EmergencyEventRepository();
  return instance;
}

module.exports = { EmergencyEventRepository, getEmergencyEventRepository };
