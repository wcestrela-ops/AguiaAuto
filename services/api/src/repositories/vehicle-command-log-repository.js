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
}

let instance = null;

function getVehicleCommandLogRepository() {
  if (!instance) instance = new VehicleCommandLogRepository();
  return instance;
}

module.exports = { VehicleCommandLogRepository, getVehicleCommandLogRepository };
