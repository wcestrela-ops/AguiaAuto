const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const {
  sqlAndTenant,
  appendTenantConditions,
  tenantIdForInsert,
} = require('../lib/tenant/repository-tenant');

class VehicleCommandLogRepository {
  constructor() {
    this.pool = getPool();
  }

  async create(entry, tenantId = DEFAULT_TENANT_ID) {
    const tid = tenantIdForInsert(entry, tenantId);
    const { rows } = await this.pool.query(
      `INSERT INTO vehicle_command_logs
        (tenant_id, vehicle_id, user_id, action, channel, status, failover, error_message, external_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        tid,
        entry.vehicle_id,
        entry.user_id || null,
        entry.action,
        entry.channel,
        entry.status || 'sent',
        Boolean(entry.failover),
        entry.error_message || null,
        entry.external_ref || null,
      ],
    );
    return rows[0];
  }

  async listByVehicle(vehicleId, { userId, limit = 20, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [vehicleId];
    let sql = `
      SELECT id, vehicle_id, user_id, action, channel, status, failover,
             error_message, external_ref, created_at
      FROM vehicle_command_logs
      WHERE vehicle_id = $1`;
    let idx = 2;
    const tenant = sqlAndTenant(tenantId, idx);
    sql += tenant.clause;
    params.push(...tenant.params);
    idx = tenant.nextIndex;

    if (userId) {
      sql += ` AND user_id = $${idx++}`;
      params.push(userId);
    }
    params.push(Math.min(limit, 50));
    sql += ` ORDER BY created_at DESC LIMIT $${idx}`;
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listRecentFailed({ hours = 24, limit = 20, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [String(hours), Math.min(limit, 50)];
    const conditions = [
      "l.status = 'failed'",
      `l.created_at >= NOW() - ($1 || ' hours')::interval`,
    ];
    appendTenantConditions(conditions, params, 3, tenantId, { alias: 'l' });
    const where = conditions.join(' AND ');

    const { rows } = await this.pool.query(
      `SELECT l.*, v.plate, v.tracker_device_id, u.email AS user_email, u.name AS user_name
       FROM vehicle_command_logs l
       JOIN vehicles v ON v.id = l.vehicle_id
       LEFT JOIN users u ON u.id = l.user_id
       WHERE ${where}
       ORDER BY l.created_at DESC
       LIMIT $2`,
      params,
    );
    return rows;
  }

  async countRecentFailed(hours = 24, tenantId = DEFAULT_TENANT_ID) {
    const params = [String(hours)];
    const conditions = [
      "status = 'failed'",
      `created_at >= NOW() - ($1 || ' hours')::interval`,
    ];
    appendTenantConditions(conditions, params, 2, tenantId);
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vehicle_command_logs WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return rows[0].count;
  }
}

let instance = null;

function getVehicleCommandLogRepository() {
  if (!instance) instance = new VehicleCommandLogRepository();
  return instance;
}

module.exports = { VehicleCommandLogRepository, getVehicleCommandLogRepository };
