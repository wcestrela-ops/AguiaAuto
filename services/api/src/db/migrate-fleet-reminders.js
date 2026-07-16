const { getPool } = require('./pool');

async function migrateFleetReminders() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fleet_reminder_notifications (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trigger         VARCHAR(60) NOT NULL DEFAULT 'fleet.reminder.daily',
      channel         VARCHAR(20) NOT NULL DEFAULT 'push',
      status          VARCHAR(20) NOT NULL DEFAULT 'sent',
      documents_count INTEGER NOT NULL DEFAULT 0,
      maintenance_count INTEGER NOT NULL DEFAULT 0,
      items_snapshot  JSONB DEFAULT '[]'::jsonb,
      error_message   TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_fleet_reminder_notifications_user
      ON fleet_reminder_notifications (user_id, created_at DESC);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_fleet_reminder_notifications_user_day
      ON fleet_reminder_notifications (user_id, trigger, ((created_at AT TIME ZONE 'UTC')::date))
      WHERE status = 'sent';

    CREATE TABLE IF NOT EXISTS fleet_reminder_runs (
      id              SERIAL PRIMARY KEY,
      started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at     TIMESTAMPTZ,
      reminders_sent  INTEGER NOT NULL DEFAULT 0,
      errors_count    INTEGER NOT NULL DEFAULT 0,
      details         JSONB DEFAULT '[]'::jsonb,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

module.exports = { migrateFleetReminders };
