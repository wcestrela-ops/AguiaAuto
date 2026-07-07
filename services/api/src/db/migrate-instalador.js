const { getPool } = require('./pool');

async function migrateInstalador() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS installation_logs (
      id                SERIAL PRIMARY KEY,
      vehicle_id        INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      installer_id      INTEGER NOT NULL REFERENCES users(id),
      gpswox_device_id  VARCHAR(50) NOT NULL,
      imei              VARCHAR(50),
      notes             TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_installation_logs_vehicle ON installation_logs (vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_installation_logs_installer ON installation_logs (installer_id);
  `);
}

module.exports = { migrateInstalador };
