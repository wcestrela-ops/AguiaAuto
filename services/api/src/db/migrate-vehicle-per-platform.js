const { getPool } = require('./pool');

async function columnExists(pool, table, column) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return rows.length > 0;
}

async function migrateVehiclePerPlatform() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE vehicles
      ADD COLUMN IF NOT EXISTS tracking_provider VARCHAR(20);

    UPDATE vehicles
       SET tracking_provider = 'gpswox'
     WHERE tracking_provider IS NULL
       AND tracker_device_id IS NOT NULL
       AND TRIM(tracker_device_id) <> '';
  `);

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS gpswox_user_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS traccar_user_id VARCHAR(50);
  `);

  if (await columnExists(pool, 'users', 'tracker_user_id')) {
    await pool.query(`
      UPDATE users
         SET gpswox_user_id = COALESCE(gpswox_user_id, tracker_user_id)
       WHERE tracker_user_id IS NOT NULL
         AND TRIM(tracker_user_id) <> '';
    `);
  }

  await pool.query(`
    ALTER TABLE tracker_sync_runs
      ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'gpswox';

    UPDATE tracker_sync_runs
       SET provider = 'gpswox'
     WHERE provider IS NULL;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_vehicles_tracking_provider
      ON vehicles (tracking_provider);
  `);
}

module.exports = { migrateVehiclePerPlatform };
