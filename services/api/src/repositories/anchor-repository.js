const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const {
  sqlAndTenant,
  appendTenantConditions,
  tenantIdForInsert,
} = require('../lib/tenant/repository-tenant');

class AnchorRepository {
  constructor() {
    this.pool = getPool();
  }

  async findActiveByVehicle(vehicleId, tenantId = DEFAULT_TENANT_ID) {
    const params = [vehicleId];
    let sql = `SELECT * FROM vehicle_anchors
       WHERE vehicle_id = $1 AND active = true AND status = 'monitoring'`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY created_at DESC LIMIT 1';
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async findActiveByDeviceId(deviceId, tenantId = DEFAULT_TENANT_ID) {
    const params = [String(deviceId)];
    let sql = `SELECT va.*, v.tracker_device_id, v.plate, v.brand, v.model, v.status AS vehicle_status
       FROM vehicle_anchors va
       JOIN vehicles v ON v.id = va.vehicle_id
       WHERE va.active = true AND va.status = 'monitoring'
         AND (v.tracker_device_id = $1 OR v.tracker_name = $1)`;
    const tenant = sqlAndTenant(tenantId, 2, { alias: 'va' });
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' LIMIT 1';
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async listMonitoring() {
    const params = [];
    const conditions = ["va.active = true", "va.status = 'monitoring'"];
    appendTenantConditions(conditions, params, 1, null, { alias: 'va', allTenants: true });
    const where = conditions.join(' AND ');

    const { rows } = await this.pool.query(
      `SELECT va.*, v.tracker_device_id, v.tracker_name, v.tracking_provider, v.plate, v.brand, v.model, v.status AS vehicle_status
       FROM vehicle_anchors va
       JOIN vehicles v ON v.id = va.vehicle_id
       WHERE ${where}
       ORDER BY va.created_at ASC`,
      params,
    );
    return rows;
  }

  async create(data, tenantId = DEFAULT_TENANT_ID) {
    const tid = tenantIdForInsert(data, tenantId);

    const deactivateParams = [data.vehicle_id];
    let deactivateSql = `UPDATE vehicle_anchors
       SET active = false, status = 'cancelled', updated_at = NOW()
       WHERE vehicle_id = $1 AND active = true AND status = 'monitoring'`;
    const tenant = sqlAndTenant(tenantId, 2);
    deactivateSql += tenant.clause;
    deactivateParams.push(...tenant.params);
    await this.pool.query(deactivateSql, deactivateParams);

    const { rows } = await this.pool.query(
      `INSERT INTO vehicle_anchors (
        tenant_id, vehicle_id, user_id, latitude, longitude, radius_meters, status, active
      ) VALUES ($1,$2,$3,$4,$5,$6,'monitoring',true)
      RETURNING *`,
      [
        tid,
        data.vehicle_id,
        data.user_id,
        data.latitude,
        data.longitude,
        data.radius_meters || 10,
      ]
    );
    return rows[0];
  }

  async deactivate(vehicleId, userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [vehicleId, userId];
    let sql = `UPDATE vehicle_anchors
       SET active = false, status = 'cancelled', updated_at = NOW()
       WHERE vehicle_id = $1 AND user_id = $2 AND active = true AND status = 'monitoring'`;
    const tenant = sqlAndTenant(tenantId, 3);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' RETURNING *';
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async markTriggered(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = `UPDATE vehicle_anchors
       SET status = 'triggered', active = false, triggered_at = NOW(), updated_at = NOW()
       WHERE id = $1`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' RETURNING *';
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }
}

let instance = null;

function getAnchorRepository() {
  if (!instance) instance = new AnchorRepository();
  return instance;
}

module.exports = { AnchorRepository, getAnchorRepository };
