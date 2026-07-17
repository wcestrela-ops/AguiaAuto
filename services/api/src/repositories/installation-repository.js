const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const {
  sqlAndTenant,
  appendTenantConditions,
  tenantIdForInsert,
} = require('../lib/tenant/repository-tenant');

class InstallationRepository {
  constructor() {
    this.pool = getPool();
  }

  async create(data, tenantId = DEFAULT_TENANT_ID) {
    const tid = tenantIdForInsert(data, tenantId);
    const { rows } = await this.pool.query(
      `INSERT INTO installation_logs
        (tenant_id, vehicle_id, installer_id, tracker_device_id, imei, notes, report,
         duration_minutes, started_at, finished_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        tid,
        data.vehicle_id,
        data.installer_id,
        data.tracker_device_id,
        data.imei,
        data.notes,
        data.report,
        data.duration_minutes,
        data.started_at,
        data.finished_at,
      ]
    );
    return rows[0];
  }

  async findById(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = `SELECT il.*, v.plate, v.brand, v.model, v.user_id,
              i.name AS installer_name, u.name AS client_name
       FROM installation_logs il
       JOIN vehicles v ON v.id = il.vehicle_id
       JOIN users i ON i.id = il.installer_id
       JOIN users u ON u.id = v.user_id
       WHERE il.id = $1`;
    const tenant = sqlAndTenant(tenantId, 2, { alias: 'il' });
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async findLatestByVehicle(vehicleId, tenantId = DEFAULT_TENANT_ID) {
    const params = [vehicleId];
    let sql = `SELECT il.*, i.name AS installer_name
       FROM installation_logs il
       JOIN users i ON i.id = il.installer_id
       WHERE il.vehicle_id = $1`;
    const tenant = sqlAndTenant(tenantId, 2, { alias: 'il' });
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY il.created_at DESC LIMIT 1';
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async listByInstaller(installerId, { limit = 50, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [installerId];
    let sql = `SELECT il.*, v.plate, v.brand, v.model, u.name AS client_name, u.email AS client_email
       FROM installation_logs il
       JOIN vehicles v ON v.id = il.vehicle_id
       JOIN users u ON u.id = v.user_id
       WHERE il.installer_id = $1`;
    const tenant = sqlAndTenant(tenantId, 2, { alias: 'il' });
    sql += tenant.clause;
    params.push(...tenant.params);
    const limitIdx = tenant.nextIndex;
    params.push(limit);
    sql += ` ORDER BY il.created_at DESC LIMIT $${limitIdx}`;
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listAll({ limit = 100, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [limit];
    const conditions = [];
    let idx = 2;
    idx = appendTenantConditions(conditions, params, idx, tenantId, { alias: 'il' });
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT il.*, v.plate, i.name AS installer_name, u.name AS client_name
       FROM installation_logs il
       JOIN vehicles v ON v.id = il.vehicle_id
       JOIN users u ON u.id = v.user_id
       JOIN users i ON i.id = il.installer_id
       ${where}
       ORDER BY il.created_at DESC LIMIT $1`,
      params
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
