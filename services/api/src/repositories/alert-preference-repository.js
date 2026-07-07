const { ALERT_TYPES } = require('@aguia/shared');
const { getPool } = require('../db/pool');
const { VEHICLE_ALERT_CHANNELS, filterVehicleAlertChannels } = require('../lib/notification-policy');

const DEFAULT_CHANNELS = VEHICLE_ALERT_CHANNELS;

class AlertPreferenceRepository {
  constructor() {
    this.pool = getPool();
  }

  async listByUser(userId, vehicleId = null) {
    const { rows } = await this.pool.query(
      `SELECT * FROM alert_preferences
       WHERE user_id = $1 AND ($2::int IS NULL OR vehicle_id = $2 OR vehicle_id IS NULL)
       ORDER BY alert_type`,
      [userId, vehicleId]
    );
    return rows;
  }

  async getForAlert(userId, vehicleId, alertType) {
    const specific = await this.pool.query(
      `SELECT * FROM alert_preferences
       WHERE user_id = $1 AND vehicle_id = $2 AND alert_type = $3 AND enabled = true
       LIMIT 1`,
      [userId, vehicleId, alertType]
    );
    if (specific.rows[0]) return specific.rows[0];

    const global = await this.pool.query(
      `SELECT * FROM alert_preferences
       WHERE user_id = $1 AND vehicle_id IS NULL AND alert_type = $2 AND enabled = true
       LIMIT 1`,
      [userId, alertType]
    );
    if (global.rows[0]) return global.rows[0];

    return null;
  }

  async resolveChannels(userId, vehicleId, alertType) {
    const pref = await this.getForAlert(userId, vehicleId, alertType);
    if (pref) return filterVehicleAlertChannels(pref.channels);
    return DEFAULT_CHANNELS;
  }

  async upsertMany(userId, preferences, vehicleId = null) {
    const saved = [];
    for (const pref of preferences) {
      if (!ALERT_TYPES.includes(pref.alert_type)) continue;
      const channels = filterVehicleAlertChannels(pref.channels || DEFAULT_CHANNELS);

      const existing = vehicleId == null
        ? await this.pool.query(
          `SELECT id FROM alert_preferences
           WHERE user_id = $1 AND alert_type = $2 AND vehicle_id IS NULL`,
          [userId, pref.alert_type]
        )
        : await this.pool.query(
          `SELECT id FROM alert_preferences
           WHERE user_id = $1 AND alert_type = $2 AND vehicle_id = $3`,
          [userId, pref.alert_type, vehicleId]
        );

      let rows;
      if (existing.rows[0]) {
        ({ rows } = await this.pool.query(
          `UPDATE alert_preferences SET channels = $2, enabled = $3, updated_at = NOW()
           WHERE id = $1 RETURNING *`,
          [existing.rows[0].id, JSON.stringify(channels), pref.enabled !== false]
        ));
      } else {
        ({ rows } = await this.pool.query(
          `INSERT INTO alert_preferences (user_id, vehicle_id, alert_type, channels, enabled)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [userId, vehicleId, pref.alert_type, JSON.stringify(channels), pref.enabled !== false]
        ));
      }
      saved.push(rows[0]);
    }
    return saved;
  }

  async getEffectivePreferences(userId, vehicleId = null) {
    const existing = await this.listByUser(userId, vehicleId);
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
