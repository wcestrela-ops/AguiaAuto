const { getPool } = require('../db/pool');

class AnchorRepository {
  constructor() {
    this.pool = getPool();
  }

  async findActiveByVehicle(vehicleId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM vehicle_anchors
       WHERE vehicle_id = $1 AND active = true AND status = 'monitoring'
       ORDER BY created_at DESC
       LIMIT 1`,
      [vehicleId]
    );
    return rows[0] || null;
  }

  async findActiveByDeviceId(deviceId) {
    const { rows } = await this.pool.query(
      `SELECT va.*, v.tracker_device_id, v.plate, v.brand, v.model, v.status AS vehicle_status
       FROM vehicle_anchors va
       JOIN vehicles v ON v.id = va.vehicle_id
       WHERE va.active = true AND va.status = 'monitoring'
         AND (v.tracker_device_id = $1 OR v.tracker_name = $1)
       LIMIT 1`,
      [String(deviceId)]
    );
    return rows[0] || null;
  }

  async listMonitoring() {
    const { rows } = await this.pool.query(
      `SELECT va.*, v.tracker_device_id, v.tracker_name, v.tracking_provider, v.plate, v.brand, v.model, v.status AS vehicle_status
       FROM vehicle_anchors va
       JOIN vehicles v ON v.id = va.vehicle_id
       WHERE va.active = true AND va.status = 'monitoring'
       ORDER BY va.created_at ASC`
    );
    return rows;
  }

  async create(data) {
    await this.pool.query(
      `UPDATE vehicle_anchors
       SET active = false, status = 'cancelled', updated_at = NOW()
       WHERE vehicle_id = $1 AND active = true AND status = 'monitoring'`,
      [data.vehicle_id]
    );

    const { rows } = await this.pool.query(
      `INSERT INTO vehicle_anchors (
        vehicle_id, user_id, latitude, longitude, radius_meters, status, active
      ) VALUES ($1,$2,$3,$4,$5,'monitoring',true)
      RETURNING *`,
      [
        data.vehicle_id,
        data.user_id,
        data.latitude,
        data.longitude,
        data.radius_meters || 10,
      ]
    );
    return rows[0];
  }

  async deactivate(vehicleId, userId) {
    const { rows } = await this.pool.query(
      `UPDATE vehicle_anchors
       SET active = false, status = 'cancelled', updated_at = NOW()
       WHERE vehicle_id = $1 AND user_id = $2 AND active = true AND status = 'monitoring'
       RETURNING *`,
      [vehicleId, userId]
    );
    return rows[0] || null;
  }

  async markTriggered(id) {
    const { rows } = await this.pool.query(
      `UPDATE vehicle_anchors
       SET status = 'triggered', active = false, triggered_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return rows[0] || null;
  }
}

let instance = null;

function getAnchorRepository() {
  if (!instance) instance = new AnchorRepository();
  return instance;
}

module.exports = { AnchorRepository, getAnchorRepository };
