const { getPool } = require('./pool');

async function migrateUserAccess() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_access_ip VARCHAR(45);

    CREATE INDEX IF NOT EXISTS idx_users_last_access_at
      ON users (last_access_at DESC)
      WHERE role = 'client';
  `);
}

module.exports = { migrateUserAccess };
