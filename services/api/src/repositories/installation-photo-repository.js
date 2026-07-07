const { getPool } = require('../db/pool');

class InstallationPhotoRepository {
  constructor() {
    this.pool = getPool();
  }

  async createMany(installationLogId, photos) {
    const rows = [];
    for (const photo of photos) {
      const { rows: inserted } = await this.pool.query(
        `INSERT INTO installation_photos
          (installation_log_id, file_path, original_filename, sort_order)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [installationLogId, photo.file_path, photo.original_filename, photo.sort_order]
      );
      rows.push(inserted[0]);
    }
    return rows;
  }

  async listByInstallationLog(installationLogId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM installation_photos
       WHERE installation_log_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [installationLogId]
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      `SELECT ip.*, il.vehicle_id, v.user_id
       FROM installation_photos ip
       JOIN installation_logs il ON il.id = ip.installation_log_id
       JOIN vehicles v ON v.id = il.vehicle_id
       WHERE ip.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async countByInstallationLog(installationLogId) {
    const { rows } = await this.pool.query(
      'SELECT COUNT(*)::int AS count FROM installation_photos WHERE installation_log_id = $1',
      [installationLogId]
    );
    return rows[0].count;
  }
}

let instance = null;

function getInstallationPhotoRepository() {
  if (!instance) instance = new InstallationPhotoRepository();
  return instance;
}

module.exports = { InstallationPhotoRepository, getInstallationPhotoRepository };
