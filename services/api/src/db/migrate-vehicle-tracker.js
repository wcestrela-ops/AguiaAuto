const { getPool } = require('./pool');

async function migrateVehicleTracker() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE vehicles
      ADD COLUMN IF NOT EXISTS tracker_model VARCHAR(100),
      ADD COLUMN IF NOT EXISTS tracker_imei VARCHAR(30),
      ADD COLUMN IF NOT EXISTS tracker_synced_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_vehicles_tracker_imei ON vehicles (tracker_imei);
    CREATE INDEX IF NOT EXISTS idx_vehicles_gpswox_device ON vehicles (tracker_device_id);
  `);
}

module.exports = { migrateVehicleTracker };
