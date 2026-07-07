const { getPool } = require('./pool');

async function migrateContratosSnapshot() {
  const pool = getPool();
  await pool.query(`
    ALTER TABLE contract_acceptances ADD COLUMN IF NOT EXISTS snapshot_html TEXT;
    ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);
}

module.exports = { migrateContratosSnapshot };
