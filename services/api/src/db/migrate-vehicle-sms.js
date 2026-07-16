const { getPool } = require('./pool');

async function migrateVehicleSms() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE vehicles
      ADD COLUMN IF NOT EXISTS tracker_phone VARCHAR(20);

    CREATE INDEX IF NOT EXISTS idx_vehicles_tracker_phone ON vehicles (tracker_phone);

    CREATE TABLE IF NOT EXISTS vehicle_command_logs (
      id              SERIAL PRIMARY KEY,
      vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action          VARCHAR(50) NOT NULL,
      channel         VARCHAR(10) NOT NULL,
      status          VARCHAR(30) NOT NULL DEFAULT 'sent',
      failover        BOOLEAN NOT NULL DEFAULT false,
      error_message   TEXT,
      external_ref    VARCHAR(100),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_vehicle_command_logs_vehicle ON vehicle_command_logs (vehicle_id);
  `);
}

module.exports = { migrateVehicleSms };
