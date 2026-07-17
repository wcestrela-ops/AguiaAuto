const { ALERT_TYPES } = require('@aguia/shared');
const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const { VEHICLE_ALERT_CHANNELS, filterVehicleAlertChannels } = require('../lib/notification-policy');
const { sqlAndTenant, tenantIdForInsert } = require('../lib/tenant/repository-tenant');

const DEFAULT_CHANNELS = VEHICLE_ALERT_CHANNELS;

class AlertPreferenceRepository {
  constructor() {
    this.pool = getPool();
  }

  async listByUser(userId, vehicleId = null, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId, vehicleId];
    let sql = `SELECT * FROM alert_preferences
       WHERE user_id = $1 AND ($2::int IS NULL OR vehicle_id = $2 OR vehicle_id IS NULL)`;
    const tenant = sqlAndTenant(tenantId, 3);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY alert_type';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async getForAlert(userId, vehicleId, alertType, tenantId = DEFAULT_TENANT_ID) {
    const specificParams = [userId, vehicleId, alertType];
    let specificSql = `SELECT * FROM alert_preferences
       WHERE user_id = $1 AND vehicle_id = $2 AND alert_type = $3 AND enabled = true`;
    const specificTenant = sqlAndTenant(tenantId, 4);
    specificSql += specificTenant.clause;
    specificParams.push(...specificTenant.params);
    specificSql += ' LIMIT 1';

    const specific = await this.pool.query(specificSql, specificParams);
    if (specific.rows[0]) return specific.rows[0];

    const globalParams = [userId, alertType];
    let globalSql = `SELECT * FROM alert_preferences
       WHERE user_id = $1 AND vehicle_id IS NULL AND alert_type = $2 AND enabled = true`;
    const globalTenant = sqlAndTenant(tenantId, 3);
    globalSql += globalTenant.clause;
    globalParams.push(...globalTenant.params);
    globalSql += ' LIMIT 1';

    const global = await this.pool.query(globalSql, globalParams);
    if (global.rows[0]) return global.rows[0];

    return null;
  }

  async resolveChannels(userId, vehicleId, alertType, tenantId = DEFAULT_TENANT_ID) {
    const pref = await this.getForAlert(userId, vehicleId, alertType, tenantId);
    if (pref) return filterVehicleAlertChannels(pref.channels);
    return DEFAULT_CHANNELS;
  }

  async upsertMany(userId, preferences, vehicleId = null, tenantId = DEFAULT_TENANT_ID) {
    const saved = [];
    for (const pref of preferences) {
      if (!ALERT_TYPES.includes(pref.alert_type)) continue;
      const channels = filterVehicleAlertChannels(pref.channels || DEFAULT_CHANNELS);

      let existing;
      if (vehicleId == null) {
        const existingParams = [userId, pref.alert_type];
        let existingSql = `SELECT id FROM alert_preferences
           WHERE user_id = $1 AND alert_type = $2 AND vehicle_id IS NULL`;
        const existingTenant = sqlAndTenant(tenantId, 3);
        existingSql += existingTenant.clause;
        existingParams.push(...existingTenant.params);
        existing = await this.pool.query(existingSql, existingParams);
      } else {
        const existingParams = [userId, pref.alert_type, vehicleId];
        let existingSql = `SELECT id FROM alert_preferences
           WHERE user_id = $1 AND alert_type = $2 AND vehicle_id = $3`;
        const existingTenant = sqlAndTenant(tenantId, 4);
        existingSql += existingTenant.clause;
        existingParams.push(...existingTenant.params);
        existing = await this.pool.query(existingSql, existingParams);
      }

      let rows;
      if (existing.rows[0]) {
        const updateParams = [existing.rows[0].id, JSON.stringify(channels), pref.enabled !== false];
        let updateSql = `UPDATE alert_preferences SET channels = $2, enabled = $3, updated_at = NOW()
           WHERE id = $1`;
        const updateTenant = sqlAndTenant(tenantId, 4);
        updateSql += updateTenant.clause;
        updateParams.push(...updateTenant.params);
        updateSql += ' RETURNING *';
        ({ rows } = await this.pool.query(updateSql, updateParams));
      } else {
        const tid = tenantIdForInsert(pref, tenantId);
        ({ rows } = await this.pool.query(
          `INSERT INTO alert_preferences (tenant_id, user_id, vehicle_id, alert_type, channels, enabled)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [tid, userId, vehicleId, pref.alert_type, JSON.stringify(channels), pref.enabled !== false]
        ));
      }
      saved.push(rows[0]);
    }
    return saved;
  }

  async getEffectivePreferences(userId, vehicleId = null, tenantId = DEFAULT_TENANT_ID) {
    const existing = await this.listByUser(userId, vehicleId, tenantId);
    const map = new Map(existing.map(p => [`${p.vehicle_id || 'global'}:${p.alert_type}`, p]));

    return ALERT_TYPES.map((type) => {
      const specific = vehicleId ? map.get(`${vehicleId}:${type}`) : null;
      const global = map.get(`global:${type}`);
      const pref = specific || global;
      return {
        alert_type: type,
        channels: filterVehicleAlertChannels(pref?.channels || DEFAULT_CHANNELS),
        enabled: pref ? pref.enabled : true,
        vehicle_id: pref?.vehicle_id || null,
      };
    });
  }
}

let instance = null;

function getAlertPreferenceRepository() {
  if (!instance) instance = new AlertPreferenceRepository();
  return instance;
}

module.exports = { AlertPreferenceRepository, getAlertPreferenceRepository, DEFAULT_CHANNELS };
