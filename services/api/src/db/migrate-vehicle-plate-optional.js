const { getPool } = require('./pool');

async function migrateVehiclePlateOptional() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE vehicles ALTER COLUMN plate DROP NOT NULL;
  `);
}

module.exports = { migrateVehiclePlateOptional };
