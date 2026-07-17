const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const {
  sqlAndTenant,
  tenantIdForInsert,
} = require('../lib/tenant/repository-tenant');

class InstallationPhotoRepository {
  constructor() {
    this.pool = getPool();
  }

  async createMany(installationLogId, photos, tenantId = DEFAULT_TENANT_ID) {
    const rows = [];
    for (const photo of photos) {
      const tid = tenantIdForInsert(photo, tenantId);
      const { rows: inserted } = await this.pool.query(
        `INSERT INTO installation_photos
          (tenant_id, installation_log_id, file_path, original_filename, sort_order)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [tid, installationLogId, photo.file_path, photo.original_filename, photo.sort_order]
      );
      rows.push(inserted[0]);
    }
    return rows;
  }

  async listByInstallationLog(installationLogId, tenantId = DEFAULT_TENANT_ID) {
    const params = [installationLogId];
    let sql = `SELECT * FROM installation_photos
       WHERE installation_log_id = $1`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY sort_order ASC, id ASC';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async findById(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = `SELECT ip.*, il.vehicle_id, v.user_id
       FROM installation_photos ip
       JOIN installation_logs il ON il.id = ip.installation_log_id
       JOIN vehicles v ON v.id = il.vehicle_id
       WHERE ip.id = $1`;
    const tenant = sqlAndTenant(tenantId, 2, { alias: 'ip' });
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async countByInstallationLog(installationLogId, tenantId = DEFAULT_TENANT_ID) {
    const params = [installationLogId];
    let sql = 'SELECT COUNT(*)::int AS count FROM installation_photos WHERE installation_log_id = $1';
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0].count;
  }
}

let instance = null;

function getInstallationPhotoRepository() {
  if (!instance) instance = new InstallationPhotoRepository();
  return instance;
}

module.exports = { InstallationPhotoRepository, getInstallationPhotoRepository };
