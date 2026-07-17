const { getPool } = require('./pool');

async function migratePhase14CustomDomain() {
  const pool = getPool();

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_custom_domain
      ON tenants (LOWER(custom_domain))
      WHERE custom_domain IS NOT NULL AND deleted_at IS NULL;
  `);

  return { custom_domain_index: true };
}

module.exports = { migratePhase14CustomDomain };
