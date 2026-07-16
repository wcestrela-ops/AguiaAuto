const { getPool } = require('./pool');

async function migrateVehicleInstallerAssignment() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS assigned_installer_id INTEGER REFERENCES users(id);
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS installation_scheduled_at TIMESTAMPTZ;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_installer
      ON vehicles (assigned_installer_id)
      WHERE assigned_installer_id IS NOT NULL;
  `);
}

module.exports = { migrateVehicleInstallerAssignment };
