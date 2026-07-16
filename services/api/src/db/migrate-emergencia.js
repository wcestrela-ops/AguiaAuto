const { getPool } = require('./pool');

async function migrateEmergencia() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_emergency_contacts (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        VARCHAR(120) NOT NULL,
      phone       VARCHAR(20) NOT NULL,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_user_emergency_contacts_user
      ON user_emergency_contacts (user_id);

    CREATE TABLE IF NOT EXISTS emergency_events (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vehicle_id    INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
      message       TEXT,
      latitude      DOUBLE PRECISION,
      longitude     DOUBLE PRECISION,
      address       TEXT,
      channels      JSONB NOT NULL DEFAULT '[]'::jsonb,
      notified_count INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_emergency_events_user_created
      ON emergency_events (user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_emergency_events_created
      ON emergency_events (created_at DESC);
  `);
}

module.exports = { migrateEmergencia };
