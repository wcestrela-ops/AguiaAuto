const { getPool } = require('./pool');

async function migrateFleetReminderChannels() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE fleet_reminder_notifications ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
    ALTER TABLE fleet_reminder_notifications ADD COLUMN IF NOT EXISTS used_fallback BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE fleet_reminder_notifications ADD COLUMN IF NOT EXISTS provider_type VARCHAR(40);
    ALTER TABLE fleet_reminder_notifications ADD COLUMN IF NOT EXISTS external_ref VARCHAR(100);

    DROP INDEX IF EXISTS idx_fleet_reminder_notifications_user_day;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_fleet_reminder_notifications_user_channel_day
      ON fleet_reminder_notifications (user_id, trigger, channel, ((created_at AT TIME ZONE 'UTC')::date))
      WHERE status = 'sent';
  `);
}

module.exports = { migrateFleetReminderChannels };
