const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const {
  sqlAndTenant,
  appendTenantConditions,
  tenantIdForInsert,
} = require('../lib/tenant/repository-tenant');

class VehicleDocumentRepository {
  constructor() {
    this.pool = getPool();
  }

  async listByUser(userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId];
    let sql = `SELECT d.*, v.plate, v.brand, v.model
       FROM vehicle_documents d
       JOIN vehicles v ON v.id = d.vehicle_id
       WHERE d.user_id = $1`;
    const tenant = sqlAndTenant(tenantId, 2, { alias: 'd' });
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY d.expiry_date ASC NULLS LAST, d.created_at DESC';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listByVehicle(vehicleId, tenantId = DEFAULT_TENANT_ID) {
    const params = [vehicleId];
    let sql = `SELECT * FROM vehicle_documents
       WHERE vehicle_id = $1`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY expiry_date ASC NULLS LAST, created_at DESC';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listAll({ limit = 200, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [Math.min(limit, 500)];
    const conditions = [];
    let idx = 2;
    idx = appendTenantConditions(conditions, params, idx, tenantId, { alias: 'd' });
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT d.*, v.plate, v.brand, v.model, u.name AS user_name, u.email AS user_email
       FROM vehicle_documents d
       JOIN vehicles v ON v.id = d.vehicle_id
       JOIN users u ON u.id = d.user_id
       ${where}
       ORDER BY d.expiry_date ASC NULLS LAST, d.created_at DESC
       LIMIT $1`,
      params,
    );
    return rows;
  }

  async findById(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = 'SELECT * FROM vehicle_documents WHERE id = $1';
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async findByIdForUser(id, userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [id, userId];
    let sql = 'SELECT * FROM vehicle_documents WHERE id = $1 AND user_id = $2';
    const tenant = sqlAndTenant(tenantId, 3);
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async create(data, tenantId = DEFAULT_TENANT_ID) {
    const tid = tenantIdForInsert(data, tenantId);
    const { rows } = await this.pool.query(
      `INSERT INTO vehicle_documents (
        tenant_id, vehicle_id, user_id, doc_type, title, expiry_date, notes, file_path, original_filename
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        tid,
        data.vehicle_id,
        data.user_id,
        data.doc_type || 'outro',
        data.title,
        data.expiry_date || null,
        data.notes || null,
        data.file_path || null,
        data.original_filename || null,
      ],
    );
    return rows[0];
  }

  async update(id, data, tenantId = DEFAULT_TENANT_ID) {
    const params = [
      id,
      data.doc_type,
      data.title,
      data.expiry_date,
      data.notes,
      data.file_path,
      data.original_filename,
    ];
    let sql = `UPDATE vehicle_documents SET
        doc_type = COALESCE($2, doc_type),
        title = COALESCE($3, title),
        expiry_date = COALESCE($4, expiry_date),
        notes = COALESCE($5, notes),
        file_path = COALESCE($6, file_path),
        original_filename = COALESCE($7, original_filename),
        updated_at = NOW()
       WHERE id = $1`;
    const tenant = sqlAndTenant(tenantId, 8);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' RETURNING *';
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async delete(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = 'DELETE FROM vehicle_documents WHERE id = $1';
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' RETURNING *';
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async countExpiringWithinDays(days = 30, tenantId = DEFAULT_TENANT_ID) {
    const params = [String(days)];
    const conditions = [
      'expiry_date IS NOT NULL',
      `expiry_date <= CURRENT_DATE + ($1 || ' days')::interval`,
      "expiry_date >= CURRENT_DATE - interval '1 day'",
    ];
    appendTenantConditions(conditions, params, 2, tenantId);
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vehicle_documents WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return rows[0].count;
  }

  async listExpiringWithinDays(days = 30, { limit = 20, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [String(days), limit];
    const conditions = [
      'd.expiry_date IS NOT NULL',
      `d.expiry_date <= CURRENT_DATE + ($1 || ' days')::interval`,
    ];
    appendTenantConditions(conditions, params, 3, tenantId, { alias: 'd' });
    const where = conditions.join(' AND ');

    const { rows } = await this.pool.query(
      `SELECT d.*, v.plate, v.brand, v.model, u.name AS user_name, u.email AS user_email
       FROM vehicle_documents d
       JOIN vehicles v ON v.id = d.vehicle_id
       JOIN users u ON u.id = d.user_id
       WHERE ${where}
       ORDER BY d.expiry_date ASC
       LIMIT $2`,
      params,
    );
    return rows;
  }

  async listNeedingReminderForUser(userId, warningDays = 30, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId, String(warningDays)];
    let sql = `SELECT d.*, v.plate, v.brand, v.model
       FROM vehicle_documents d
       JOIN vehicles v ON v.id = d.vehicle_id
       WHERE d.user_id = $1
         AND d.expiry_date IS NOT NULL
         AND d.expiry_date <= CURRENT_DATE + ($2 || ' days')::interval`;
    const tenant = sqlAndTenant(tenantId, 3, { alias: 'd' });
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY d.expiry_date ASC';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listUserIdsNeedingReminder(warningDays = 30) {
    const params = [String(warningDays)];
    const conditions = [
      'd.expiry_date IS NOT NULL',
      `d.expiry_date <= CURRENT_DATE + ($1 || ' days')::interval`,
      'u.active = true',
    ];
    appendTenantConditions(conditions, params, 2, null, { alias: 'd', allTenants: true });
    const where = conditions.join(' AND ');

    const { rows } = await this.pool.query(
      `SELECT DISTINCT d.user_id
       FROM vehicle_documents d
       JOIN users u ON u.id = d.user_id
       WHERE ${where}`,
      params,
    );
    return rows.map((row) => row.user_id);
  }
}

let instance = null;

function getVehicleDocumentRepository() {
  if (!instance) instance = new VehicleDocumentRepository();
  return instance;
}

module.exports = { VehicleDocumentRepository, getVehicleDocumentRepository };
