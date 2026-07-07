const { getPool } = require('../db/pool');

class AlertRepository {
  constructor() {
    this.pool = getPool();
  }

  async create(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO alert_events (
        user_id, vehicle_id, alert_type, title, message, source,
        source_event_id, device_id, payload, channels_sent, delivery_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        data.user_id,
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

  async findRecentDuplicate({ source, sourceEventId, minutes = 5 }) {
    if (!sourceEventId) return null;
    const { rows } = await this.pool.query(
      `SELECT * FROM alert_events
       WHERE source = $1 AND source_event_id = $2
       AND created_at > NOW() - ($3::text || ' minutes')::interval
       LIMIT 1`,
      [source, sourceEventId, minutes]
    );
    return rows[0] || null;
  }

  async listByUser(userId, { limit = 50, unreadOnly = false } = {}) {
    const { rows } = await this.pool.query(
      `SELECT ae.*, v.plate, v.brand, v.model
       FROM alert_events ae
       LEFT JOIN vehicles v ON v.id = ae.vehicle_id
       WHERE ae.user_id = $1
         ${unreadOnly ? 'AND ae.read_at IS NULL' : ''}
       ORDER BY ae.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows;
  }

  async listAll({ limit = 100 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT ae.*, u.email AS user_email, u.name AS user_name,
              v.plate AS vehicle_plate
       FROM alert_events ae
       JOIN users u ON u.id = ae.user_id
       LEFT JOIN vehicles v ON v.id = ae.vehicle_id
       ORDER BY ae.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async markRead(id, userId) {
    const { rows } = await this.pool.query(
      `UPDATE alert_events SET read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND read_at IS NULL
       RETURNING *`,
      [id, userId]
    );
    return rows[0] || null;
  }

  async markAllRead(userId) {
    await this.pool.query(
      `UPDATE alert_events SET read_at = NOW()
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
  }

  async countUnread(userId) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM alert_events
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return rows[0].count;
  }

  async updateDelivery(id, { channels_sent, delivery_status }) {
    const { rows } = await this.pool.query(
      `UPDATE alert_events SET
        channels_sent = COALESCE($2, channels_sent),
        delivery_status = COALESCE($3, delivery_status)
       WHERE id = $1 RETURNING *`,
      [id, JSON.stringify(channels_sent), delivery_status]
    );
    return rows[0];
  }
}

let instance = null;

function getAlertRepository() {
  if (!instance) instance = new AlertRepository();
  return instance;
}

module.exports = { AlertRepository, getAlertRepository };
