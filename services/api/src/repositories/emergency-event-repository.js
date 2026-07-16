const { getPool } = require('../db/pool');

class EmergencyEventRepository {
  constructor() {
    this.pool = getPool();
  }

  async create(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO emergency_events (
        user_id, vehicle_id, message, latitude, longitude, address, channels, notified_count
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
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

  async findLatestForUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM emergency_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );
    return rows[0] || null;
  }

  async countSince(hours = 24) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM emergency_events
       WHERE created_at >= NOW() - ($1 || ' hours')::interval`,
      [String(hours)],
    );
    return rows[0].count;
  }

  async listRecent({ limit = 20 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT e.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
              v.plate, v.brand, v.model
       FROM emergency_events e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN vehicles v ON v.id = e.vehicle_id
       ORDER BY e.created_at DESC
       LIMIT $1`,
      [Math.min(limit, 100)],
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
