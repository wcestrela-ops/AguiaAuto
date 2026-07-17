const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const {
  sqlAndTenant,
  appendTenantConditions,
  tenantIdForInsert,
} = require('../lib/tenant/repository-tenant');

class VehicleMaintenanceRepository {
  constructor() {
    this.pool = getPool();
  }

  async listByUser(userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId];
    let sql = `SELECT m.*, v.plate, v.brand, v.model
       FROM vehicle_maintenance_records m
       JOIN vehicles v ON v.id = m.vehicle_id
       WHERE m.user_id = $1`;
    const tenant = sqlAndTenant(tenantId, 2, { alias: 'm' });
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY m.performed_at DESC, m.created_at DESC';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listByVehicle(vehicleId, tenantId = DEFAULT_TENANT_ID) {
    const params = [vehicleId];
    let sql = `SELECT * FROM vehicle_maintenance_records
       WHERE vehicle_id = $1`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY performed_at DESC, created_at DESC';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listAll({ limit = 200, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [Math.min(limit, 500)];
    const conditions = [];
    let idx = 2;
    idx = appendTenantConditions(conditions, params, idx, tenantId, { alias: 'm' });
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT m.*, v.plate, v.brand, v.model, u.name AS user_name, u.email AS user_email
       FROM vehicle_maintenance_records m
       JOIN vehicles v ON v.id = m.vehicle_id
       JOIN users u ON u.id = m.user_id
       ${where}
       ORDER BY m.next_due_date ASC NULLS LAST, m.performed_at DESC
       LIMIT $1`,
      params,
    );
    return rows;
  }

  async findById(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = 'SELECT * FROM vehicle_maintenance_records WHERE id = $1';
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async findByIdForUser(id, userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [id, userId];
    let sql = 'SELECT * FROM vehicle_maintenance_records WHERE id = $1 AND user_id = $2';
    const tenant = sqlAndTenant(tenantId, 3);
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async create(data, tenantId = DEFAULT_TENANT_ID) {
    const tid = tenantIdForInsert(data, tenantId);
    const { rows } = await this.pool.query(
      `INSERT INTO vehicle_maintenance_records (
        tenant_id, vehicle_id, user_id, service_type, title, performed_at,
        odometer_km, cost, next_due_date, next_due_km, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        tid,
        data.vehicle_id,
        data.user_id,
        data.service_type || 'revisao',
        data.title,
        data.performed_at,
        data.odometer_km ?? null,
        data.cost ?? null,
        data.next_due_date || null,
        data.next_due_km ?? null,
        data.notes || null,
      ],
    );
    return rows[0];
  }

  async update(id, data, tenantId = DEFAULT_TENANT_ID) {
    const params = [
      id,
      data.service_type,
      data.title,
      data.performed_at,
      data.odometer_km,
      data.cost,
      data.next_due_date,
      data.next_due_km,
      data.notes,
    ];
    let sql = `UPDATE vehicle_maintenance_records SET
        service_type = COALESCE($2, service_type),
        title = COALESCE($3, title),
        performed_at = COALESCE($4, performed_at),
        odometer_km = COALESCE($5, odometer_km),
        cost = COALESCE($6, cost),
        next_due_date = COALESCE($7, next_due_date),
        next_due_km = COALESCE($8, next_due_km),
        notes = COALESCE($9, notes),
        updated_at = NOW()
       WHERE id = $1`;
    const tenant = sqlAndTenant(tenantId, 10);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' RETURNING *';
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async delete(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = 'DELETE FROM vehicle_maintenance_records WHERE id = $1';
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' RETURNING *';
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async countDueWithinDays(days = 30, tenantId = DEFAULT_TENANT_ID) {
    const params = [String(days)];
    const conditions = [
      'next_due_date IS NOT NULL',
      `next_due_date <= CURRENT_DATE + ($1 || ' days')::interval`,
    ];
    appendTenantConditions(conditions, params, 2, tenantId);
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vehicle_maintenance_records WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return rows[0].count;
  }

  async listDueWithinDays(days = 30, { limit = 20, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [String(days), limit];
    const conditions = [
      'm.next_due_date IS NOT NULL',
      `m.next_due_date <= CURRENT_DATE + ($1 || ' days')::interval`,
    ];
    appendTenantConditions(conditions, params, 3, tenantId, { alias: 'm' });
    const where = conditions.join(' AND ');

    const { rows } = await this.pool.query(
      `SELECT m.*, v.plate, v.brand, v.model, u.name AS user_name, u.email AS user_email
       FROM vehicle_maintenance_records m
       JOIN vehicles v ON v.id = m.vehicle_id
       JOIN users u ON u.id = m.user_id
       WHERE ${where}
       ORDER BY m.next_due_date ASC
       LIMIT $2`,
      params,
    );
    return rows;
  }

  async listNeedingReminderForUser(userId, warningDays = 30, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId, String(warningDays)];
    let sql = `SELECT m.*, v.plate, v.brand, v.model
       FROM vehicle_maintenance_records m
       JOIN vehicles v ON v.id = m.vehicle_id
       WHERE m.user_id = $1
         AND m.next_due_date IS NOT NULL
         AND m.next_due_date <= CURRENT_DATE + ($2 || ' days')::interval`;
    const tenant = sqlAndTenant(tenantId, 3, { alias: 'm' });
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY m.next_due_date ASC';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listUserIdsNeedingReminder(warningDays = 30) {
    const params = [String(warningDays)];
    const conditions = [
      'm.next_due_date IS NOT NULL',
      `m.next_due_date <= CURRENT_DATE + ($1 || ' days')::interval`,
      'u.active = true',
    ];
    appendTenantConditions(conditions, params, 2, null, { alias: 'm', allTenants: true });
    const where = conditions.join(' AND ');

    const { rows } = await this.pool.query(
      `SELECT DISTINCT m.user_id
       FROM vehicle_maintenance_records m
       JOIN users u ON u.id = m.user_id
       WHERE ${where}`,
      params,
    );
    return rows.map((row) => row.user_id);
  }
}

let instance = null;

function getVehicleMaintenanceRepository() {
  if (!instance) instance = new VehicleMaintenanceRepository();
  return instance;
}

module.exports = { VehicleMaintenanceRepository, getVehicleMaintenanceRepository };
