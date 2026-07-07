const { getPool } = require('./pool');

async function migrateAncora() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicle_anchors (
      id              SERIAL PRIMARY KEY,
      vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      latitude        DOUBLE PRECISION NOT NULL,
      longitude       DOUBLE PRECISION NOT NULL,
      radius_meters   INTEGER NOT NULL DEFAULT 10,
      status          VARCHAR(20) NOT NULL DEFAULT 'monitoring',
      active          BOOLEAN NOT NULL DEFAULT true,
      triggered_at    TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_anchors_active_vehicle
      ON vehicle_anchors (vehicle_id)
      WHERE active = true AND status = 'monitoring';

    CREATE INDEX IF NOT EXISTS idx_vehicle_anchors_monitoring
      ON vehicle_anchors (status)
      WHERE active = true AND status = 'monitoring';
  `);
}

module.exports = { migrateAncora };
