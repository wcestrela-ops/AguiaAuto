const { getPool } = require('./pool');

async function migrateAlerts() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS alert_preferences (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vehicle_id  INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
      alert_type  VARCHAR(50) NOT NULL,
      channels    JSONB NOT NULL DEFAULT '["push","whatsapp"]'::jsonb,
      enabled     BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_prefs_user_global_type
      ON alert_preferences (user_id, alert_type)
      WHERE vehicle_id IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_prefs_user_vehicle_type
      ON alert_preferences (user_id, vehicle_id, alert_type)
      WHERE vehicle_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS alert_events (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vehicle_id       INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
      alert_type       VARCHAR(50) NOT NULL,
      title            VARCHAR(255) NOT NULL,
      message          TEXT NOT NULL,
      source           VARCHAR(30) NOT NULL DEFAULT 'gpswox',
      source_event_id  VARCHAR(120),
      device_id        VARCHAR(50),
      payload          JSONB,
      channels_sent    JSONB NOT NULL DEFAULT '[]'::jsonb,
      delivery_status  VARCHAR(30) NOT NULL DEFAULT 'pending',
      read_at          TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_alert_events_user ON alert_events (user_id);
    CREATE INDEX IF NOT EXISTS idx_alert_events_vehicle ON alert_events (vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_alert_events_created ON alert_events (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_alert_events_source ON alert_events (source, source_event_id);
  `);
}

module.exports = { migrateAlerts };
