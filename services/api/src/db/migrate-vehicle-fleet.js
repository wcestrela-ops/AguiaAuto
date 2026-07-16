const { getPool } = require('./pool');

async function migrateVehicleFleet() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicle_documents (
      id                SERIAL PRIMARY KEY,
      vehicle_id        INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      doc_type          VARCHAR(30) NOT NULL DEFAULT 'outro',
      title             VARCHAR(120) NOT NULL,
      expiry_date       DATE,
      notes             TEXT,
      file_path         TEXT,
      original_filename VARCHAR(255),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vehicle_maintenance_records (
      id                SERIAL PRIMARY KEY,
      vehicle_id        INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_type      VARCHAR(40) NOT NULL DEFAULT 'revisao',
      title             VARCHAR(120) NOT NULL,
      performed_at      DATE NOT NULL,
      odometer_km       INTEGER,
      cost              NUMERIC(10, 2),
      next_due_date     DATE,
      next_due_km       INTEGER,
      notes             TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle
      ON vehicle_documents (vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_vehicle_documents_user
      ON vehicle_documents (user_id);
    CREATE INDEX IF NOT EXISTS idx_vehicle_documents_expiry
      ON vehicle_documents (expiry_date)
      WHERE expiry_date IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_vehicle
      ON vehicle_maintenance_records (vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_user
      ON vehicle_maintenance_records (user_id);
    CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_next_due
      ON vehicle_maintenance_records (next_due_date)
      WHERE next_due_date IS NOT NULL;
  `);
}

module.exports = { migrateVehicleFleet };
