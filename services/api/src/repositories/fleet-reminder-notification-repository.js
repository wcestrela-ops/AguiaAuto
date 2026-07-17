const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const {
  sqlAndTenant,
  appendTenantConditions,
  tenantIdForInsert,
} = require('../lib/tenant/repository-tenant');

class FleetReminderNotificationRepository {
  constructor() {
    this.pool = getPool();
  }

  async create(data, tenantId = DEFAULT_TENANT_ID) {
    const tid = tenantIdForInsert(data, tenantId);
    const { rows } = await this.pool.query(
      `INSERT INTO fleet_reminder_notifications (
        tenant_id, user_id, trigger, channel, status, documents_count, maintenance_count,
        items_snapshot, error_message, phone, used_fallback, provider_type, external_ref
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        tid,
        data.user_id,
        data.trigger || 'fleet.reminder.daily',
        data.channel || 'push',
        data.status || 'sent',
        data.documents_count || 0,
        data.maintenance_count || 0,
        JSON.stringify(data.items_snapshot || []),
        data.error_message || null,
        data.phone || null,
        data.used_fallback === true,
        data.provider_type || null,
        data.external_ref || null,
      ],
    );
    return rows[0];
  }

  async hasSentForUserTriggerToday(userId, trigger = 'fleet.reminder.daily', tenantId = DEFAULT_TENANT_ID) {
    if (!userId) return false;
    const params = [userId, trigger];
    let sql = `SELECT 1 FROM fleet_reminder_notifications
       WHERE user_id = $1
         AND trigger = $2
         AND status = 'sent'
         AND created_at::date = CURRENT_DATE`;
    const tenant = sqlAndTenant(tenantId, 3);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' LIMIT 1';
    const { rows } = await this.pool.query(sql, params);
    return rows.length > 0;
  }

  async listRecentRuns({ limit = 10, tenantId = DEFAULT_TENANT_ID } = {}) {
    const cappedLimit = Math.min(limit, 50);
    const params = [cappedLimit];
    const conditions = [];
    appendTenantConditions(conditions, params, 2, tenantId);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT id, started_at, finished_at, reminders_sent, errors_count, created_at
       FROM fleet_reminder_runs
       ${where}
       ORDER BY started_at DESC
       LIMIT $1`,
      params,
    );
    return rows;
  }

  async listRecent({ limit = 50, userId, tenantId = DEFAULT_TENANT_ID } = {}) {
    const cappedLimit = Math.min(limit, 200);
    const params = [];
    const conditions = [];
    let idx = 1;

    if (userId) {
      conditions.push(`frn.user_id = $${idx++}`);
      params.push(userId);
    }
    idx = appendTenantConditions(conditions, params, idx, tenantId, { alias: 'frn' });
    params.push(cappedLimit);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT frn.*, u.name AS user_name, u.email AS user_email
       FROM fleet_reminder_notifications frn
       JOIN users u ON u.id = frn.user_id
       ${where}
       ORDER BY frn.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows;
  }
}

let instance = null;

function getFleetReminderNotificationRepository() {
  if (!instance) instance = new FleetReminderNotificationRepository();
  return instance;
}

module.exports = {
  FleetReminderNotificationRepository,
  getFleetReminderNotificationRepository,
};
