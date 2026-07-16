const { getPool } = require('../db/pool');

class VehicleCommandLogRepository {
  constructor() {
    this.pool = getPool();
  }

  async create(entry) {
    const { rows } = await this.pool.query(
      `INSERT INTO vehicle_command_logs
        (vehicle_id, user_id, action, channel, status, failover, error_message, external_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
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

  async listByVehicle(vehicleId, { userId, limit = 20 } = {}) {
    const params = [vehicleId, Math.min(limit, 50)];
    let sql = `
      SELECT id, vehicle_id, user_id, action, channel, status, failover,
             error_message, external_ref, created_at
      FROM vehicle_command_logs
      WHERE vehicle_id = $1`;
    if (userId) {
      sql += ' AND user_id = $3';
      params.push(userId);
    }
    sql += ' ORDER BY created_at DESC LIMIT $2';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listRecentFailed({ hours = 24, limit = 20 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT l.*, v.plate, v.tracker_device_id, u.email AS user_email, u.name AS user_name
       FROM vehicle_command_logs l
       JOIN vehicles v ON v.id = l.vehicle_id
       LEFT JOIN users u ON u.id = l.user_id
       WHERE l.status = 'failed'
         AND l.created_at >= NOW() - ($1 || ' hours')::interval
       ORDER BY l.created_at DESC
       LIMIT $2`,
      [String(hours), Math.min(limit, 50)],
    );
    return rows;
  }

  async countRecentFailed(hours = 24) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vehicle_command_logs
       WHERE status = 'failed'
         AND created_at >= NOW() - ($1 || ' hours')::interval`,
      [String(hours)],
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
