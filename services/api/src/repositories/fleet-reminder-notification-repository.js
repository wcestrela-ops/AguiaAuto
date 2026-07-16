const { getPool } = require('../db/pool');

class FleetReminderNotificationRepository {
  constructor() {
    this.pool = getPool();
  }

  async create(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO fleet_reminder_notifications (
        user_id, trigger, channel, status, documents_count, maintenance_count,
        items_snapshot, error_message
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        data.user_id,
        data.trigger || 'fleet.reminder.daily',
        data.channel || 'push',
        data.status || 'sent',
        data.documents_count || 0,
        data.maintenance_count || 0,
        JSON.stringify(data.items_snapshot || []),
        data.error_message || null,
      ],
    );
    return rows[0];
  }

  async hasSentForUserTriggerToday(userId, trigger = 'fleet.reminder.daily') {
    if (!userId) return false;
    const { rows } = await this.pool.query(
      `SELECT 1 FROM fleet_reminder_notifications
       WHERE user_id = $1
         AND trigger = $2
         AND status = 'sent'
         AND created_at::date = CURRENT_DATE
       LIMIT 1`,
      [userId, trigger],
    );
    return rows.length > 0;
  }

  async listRecentRuns({ limit = 10 } = {}) {
    const cappedLimit = Math.min(limit, 50);
    const { rows } = await this.pool.query(
      `SELECT id, started_at, finished_at, reminders_sent, errors_count, created_at
       FROM fleet_reminder_runs
       ORDER BY started_at DESC
       LIMIT $1`,
      [cappedLimit],
    );
    return rows;
  }

  async listRecent({ limit = 50, userId } = {}) {
    const cappedLimit = Math.min(limit, 200);
    const params = [];
    let where = '';

    if (userId) {
      params.push(userId);
      where = 'WHERE frn.user_id = $1';
    }
    params.push(cappedLimit);

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
