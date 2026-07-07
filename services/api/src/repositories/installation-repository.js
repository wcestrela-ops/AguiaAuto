const { getPool } = require('../db/pool');

class InstallationRepository {
  constructor() {
    this.pool = getPool();
  }

  async create(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO installation_logs (vehicle_id, installer_id, gpswox_device_id, imei, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.vehicle_id, data.installer_id, data.gpswox_device_id, data.imei, data.notes]
    );
    return rows[0];
  }

  async listByInstaller(installerId, { limit = 50 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT il.*, v.plate, v.brand, v.model, u.name AS client_name, u.email AS client_email
       FROM installation_logs il
       JOIN vehicles v ON v.id = il.vehicle_id
       JOIN users u ON u.id = v.user_id
       WHERE il.installer_id = $1
       ORDER BY il.created_at DESC LIMIT $2`,
      [installerId, limit]
    );
    return rows;
  }

  async listAll({ limit = 100 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT il.*, v.plate, i.name AS installer_name, u.name AS client_name
       FROM installation_logs il
       JOIN vehicles v ON v.id = il.vehicle_id
       JOIN users u ON u.id = v.user_id
       JOIN users i ON i.id = il.installer_id
       ORDER BY il.created_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }
}

let instance = null;

function getInstallationRepository() {
  if (!instance) instance = new InstallationRepository();
  return instance;
}

module.exports = { InstallationRepository, getInstallationRepository };
