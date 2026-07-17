const { getPool } = require('./pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

const ENTITY_TYPES = ['user', 'vehicle', 'device'];
const SYNC_STRATEGIES = ['PROVIDER_MASTER', 'READ_ONLY'];

async function migratePhase6TrackingProvider() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_tracking_configs (
      tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      default_provider VARCHAR(30) NOT NULL DEFAULT 'gpswox',
      sync_strategy VARCHAR(30) NOT NULL DEFAULT 'PROVIDER_MASTER',
      settings JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS external_entity_mappings (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider VARCHAR(30) NOT NULL DEFAULT 'gpswox',
      entity_type VARCHAR(30) NOT NULL,
      internal_id INTEGER NOT NULL,
      external_id VARCHAR(120) NOT NULL,
      sync_strategy VARCHAR(30) NOT NULL DEFAULT 'PROVIDER_MASTER',
      metadata JSONB NOT NULL DEFAULT '{}',
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, provider, entity_type, internal_id)
    );

    CREATE INDEX IF NOT EXISTS idx_eem_tenant_lookup
      ON external_entity_mappings (tenant_id, provider, entity_type);

    CREATE INDEX IF NOT EXISTS idx_eem_external_lookup
      ON external_entity_mappings (tenant_id, provider, entity_type, external_id);

    CREATE INDEX IF NOT EXISTS idx_eem_internal
      ON external_entity_mappings (internal_id, entity_type);
  `);

  await pool.query(
    `INSERT INTO tenant_tracking_configs (tenant_id, default_provider, sync_strategy)
     VALUES ($1, 'gpswox', 'PROVIDER_MASTER')
     ON CONFLICT (tenant_id) DO NOTHING`,
    [DEFAULT_TENANT_ID],
  );

  const { rows: gpswoxUsers } = await pool.query(
    `SELECT id, tenant_id, gpswox_user_id AS external_id
     FROM users
     WHERE gpswox_user_id IS NOT NULL AND TRIM(gpswox_user_id) <> ''`,
  );
  for (const row of gpswoxUsers) {
    await pool.query(
      `INSERT INTO external_entity_mappings (
        tenant_id, provider, entity_type, internal_id, external_id, sync_strategy
      ) VALUES ($1, 'gpswox', 'user', $2, $3, 'PROVIDER_MASTER')
      ON CONFLICT (tenant_id, provider, entity_type, internal_id) DO UPDATE SET
        external_id = EXCLUDED.external_id,
        updated_at = NOW()`,
      [row.tenant_id || DEFAULT_TENANT_ID, row.id, row.external_id],
    );
  }

  const { rows: traccarUsers } = await pool.query(
    `SELECT id, tenant_id, traccar_user_id AS external_id
     FROM users
     WHERE traccar_user_id IS NOT NULL AND TRIM(traccar_user_id) <> ''`,
  );
  for (const row of traccarUsers) {
    await pool.query(
      `INSERT INTO external_entity_mappings (
        tenant_id, provider, entity_type, internal_id, external_id, sync_strategy
      ) VALUES ($1, 'traccar', 'user', $2, $3, 'PROVIDER_MASTER')
      ON CONFLICT (tenant_id, provider, entity_type, internal_id) DO UPDATE SET
        external_id = EXCLUDED.external_id,
        updated_at = NOW()`,
      [row.tenant_id || DEFAULT_TENANT_ID, row.id, row.external_id],
    );
  }

  const { rows: vehicles } = await pool.query(
    `SELECT id, tenant_id, tracking_provider, tracker_device_id AS external_id
     FROM vehicles
     WHERE tracker_device_id IS NOT NULL AND TRIM(tracker_device_id) <> ''`,
  );
  for (const row of vehicles) {
    const provider = String(row.tracking_provider || 'gpswox').toLowerCase() === 'traccar' ? 'traccar' : 'gpswox';
    await pool.query(
      `INSERT INTO external_entity_mappings (
        tenant_id, provider, entity_type, internal_id, external_id, sync_strategy
      ) VALUES ($1, $2, 'vehicle', $3, $4, 'PROVIDER_MASTER')
      ON CONFLICT (tenant_id, provider, entity_type, internal_id) DO UPDATE SET
        external_id = EXCLUDED.external_id,
        provider = EXCLUDED.provider,
        updated_at = NOW()`,
      [row.tenant_id || DEFAULT_TENANT_ID, provider, row.id, row.external_id],
    );
  }

  return {
    gpswox_users: gpswoxUsers.length,
    traccar_users: traccarUsers.length,
    vehicles: vehicles.length,
  };
}

module.exports = {
  migratePhase6TrackingProvider,
  ENTITY_TYPES,
  SYNC_STRATEGIES,
};
