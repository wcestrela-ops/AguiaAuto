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
      report            TEXT,
      duration_minutes  INTEGER,
      started_at        TIMESTAMPTZ,
      finished_at       TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_installation_logs_vehicle ON installation_logs (vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_installation_logs_installer ON installation_logs (installer_id);

    ALTER TABLE installation_logs ADD COLUMN IF NOT EXISTS report TEXT;
    ALTER TABLE installation_logs ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
    ALTER TABLE installation_logs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
    ALTER TABLE installation_logs ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS installation_photos (
      id                  SERIAL PRIMARY KEY,
      installation_log_id INTEGER NOT NULL REFERENCES installation_logs(id) ON DELETE CASCADE,
      file_path           TEXT NOT NULL,
      original_filename   VARCHAR(255),
      sort_order          SMALLINT NOT NULL DEFAULT 0,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_installation_photos_log ON installation_photos (installation_log_id);
  `);
}

module.exports = { migrateInstalador };
