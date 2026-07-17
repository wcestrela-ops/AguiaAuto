const { getPool } = require('./pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

const CREDENTIAL_MODES = ['SHARED', 'OWN'];
const INFRA_KEYS = ['gateway', 'gateway_client'];

async function migratePhase7TenantIntegrations() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE integration_configs
      ADD COLUMN IF NOT EXISTS credential_mode VARCHAR(20) NOT NULL DEFAULT 'OWN';

    CREATE INDEX IF NOT EXISTS idx_integration_configs_mode
      ON integration_configs (tenant_id, credential_mode);
  `);

  await pool.query(
    `UPDATE integration_configs SET credential_mode = 'OWN' WHERE tenant_id = $1`,
    [DEFAULT_TENANT_ID],
  );

  await pool.query(
    `UPDATE integration_configs SET credential_mode = 'SHARED'
     WHERE tenant_id <> $1
       AND integration_key NOT IN ('gateway', 'gateway_client')`,
    [DEFAULT_TENANT_ID],
  );

  const { rows: tenants } = await pool.query(
    `SELECT id FROM tenants WHERE deleted_at IS NULL AND id <> $1`,
    [DEFAULT_TENANT_ID],
  );

  let seeded = 0;
  for (const tenant of tenants) {
    const { rows: existing } = await pool.query(
      `SELECT 1 FROM integration_configs WHERE tenant_id = $1 LIMIT 1`,
      [tenant.id],
    );
    if (existing.length > 0) continue;

    await pool.query(
      `INSERT INTO integration_configs (tenant_id, integration_key, settings, enabled, credential_mode)
       SELECT $1, ic.integration_key, '{}'::jsonb, ic.enabled, 'SHARED'
       FROM integration_configs ic
       WHERE ic.tenant_id = $2
         AND ic.integration_key NOT IN ('gateway', 'gateway_client')
       ON CONFLICT (tenant_id, integration_key) DO NOTHING`,
      [tenant.id, DEFAULT_TENANT_ID],
    );
    seeded += 1;
  }

  return { credential_modes: CREDENTIAL_MODES, tenants_seeded: seeded };
}

module.exports = {
  migratePhase7TenantIntegrations,
  CREDENTIAL_MODES,
  INFRA_KEYS,
};
