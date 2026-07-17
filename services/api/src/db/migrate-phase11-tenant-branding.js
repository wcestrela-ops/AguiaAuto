const { getPool } = require('./pool');

async function migratePhase11TenantBranding() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS brand_name VARCHAR(150),
      ADD COLUMN IF NOT EXISTS logo_url TEXT,
      ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7),
      ADD COLUMN IF NOT EXISTS favicon_url TEXT,
      ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255);
  `);

  await pool.query(`
    UPDATE tenants
    SET brand_name = COALESCE(brand_name, trade_name, name),
        primary_color = COALESCE(primary_color, '#2563eb')
    WHERE id = 1;
  `);

  return { branding_columns: true };
}

module.exports = { migratePhase11TenantBranding };
