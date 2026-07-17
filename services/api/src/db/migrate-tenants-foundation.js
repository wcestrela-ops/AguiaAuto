const { getPool } = require('./pool');

const CORE_TABLES = [
  'vehicles',
  'invoices',
  'subscriptions',
  'plans',
  'site_content',
];

async function migrateTenantsFoundation() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS document_type VARCHAR(20),
      ADD COLUMN IF NOT EXISTS document_number VARCHAR(30),
      ADD COLUMN IF NOT EXISTS email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo',
      ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
      ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
  `);

  for (const table of CORE_TABLES) {
    await pool.query(`
      ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_${table}_tenant_id ON ${table} (tenant_id);
    `);
  }

  await pool.query(`
    ALTER TABLE integration_configs
      ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'integration_configs_pkey'
          AND conrelid = 'integration_configs'::regclass
      ) THEN
        ALTER TABLE integration_configs DROP CONSTRAINT integration_configs_pkey;
      END IF;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'integration_configs_pkey'
          AND conrelid = 'integration_configs'::regclass
      ) THEN
        ALTER TABLE integration_configs
          ADD CONSTRAINT integration_configs_pkey PRIMARY KEY (tenant_id, integration_key);
      END IF;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_integration_configs_tenant ON integration_configs (tenant_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_user ON vehicles (tenant_id, user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_invoices_tenant_user ON invoices (tenant_id, user_id);
  `);
}

module.exports = { migrateTenantsFoundation };
