const { getPool } = require('./pool');

const MODULE_CATALOG = [
  { code: 'CORE_CUSTOMERS', name: 'Gestão de clientes', category: 'core', is_core: true, is_public: true },
  { code: 'CORE_VEHICLES', name: 'Gestão de veículos', category: 'core', is_core: true, is_public: true },
  { code: 'TRACKING', name: 'Rastreamento', category: 'tracking', is_core: false, is_public: true },
  { code: 'FINANCE', name: 'Financeiro', category: 'finance', is_core: false, is_public: true },
  { code: 'BILLING_AUTOMATION', name: 'Cobrança automatizada', category: 'finance', is_core: false, is_public: true },
  { code: 'CONTRACTS', name: 'Contratos digitais', category: 'legal', is_core: false, is_public: true },
  { code: 'WHATSAPP', name: 'WhatsApp', category: 'communication', is_core: false, is_public: true },
  { code: 'SMS', name: 'SMS', category: 'communication', is_core: false, is_public: true },
  { code: 'LANDING_PAGE', name: 'Landing page', category: 'marketing', is_core: false, is_public: true },
  { code: 'CRM', name: 'CRM comercial', category: 'marketing', is_core: false, is_public: false },
  { code: 'NOTIFICATIONS', name: 'Notificações', category: 'communication', is_core: false, is_public: true },
  { code: 'TELEMETRY', name: 'Telemetria', category: 'tracking', is_core: false, is_public: false },
  { code: 'REPORTS', name: 'Relatórios', category: 'analytics', is_core: false, is_public: true },
  { code: 'SERVICE_ORDERS', name: 'Ordens de serviço', category: 'operations', is_core: false, is_public: false },
  { code: 'INSTALLATIONS', name: 'Instalações', category: 'operations', is_core: false, is_public: true },
  { code: 'API_ACCESS', name: 'API externa', category: 'platform', is_core: false, is_public: false },
  { code: 'WHITE_LABEL', name: 'White label', category: 'platform', is_core: false, is_public: false },
  { code: 'MOBILE_PWA', name: 'Aplicativo PWA', category: 'platform', is_core: true, is_public: true },
];

async function migratePhase3Modules() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS modules (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(150) NOT NULL,
      description TEXT,
      category VARCHAR(50),
      icon VARCHAR(50),
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      is_core BOOLEAN NOT NULL DEFAULT false,
      is_public BOOLEAN NOT NULL DEFAULT true,
      configuration_schema JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tenant_modules (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      source VARCHAR(20) NOT NULL DEFAULT 'PLAN',
      starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      trial_ends_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      configuration JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, module_id)
    );

    CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant ON tenant_modules (tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_modules_code ON modules (code);
  `);

  for (const mod of MODULE_CATALOG) {
    await pool.query(
      `INSERT INTO modules (code, name, category, is_core, is_public, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         is_core = EXCLUDED.is_core,
         is_public = EXCLUDED.is_public,
         updated_at = NOW()`,
      [mod.code, mod.name, mod.category, mod.is_core, mod.is_public],
    );
  }

  const { rows: allModules } = await pool.query(`SELECT id FROM modules WHERE status = 'ACTIVE'`);
  for (const moduleRow of allModules) {
    await pool.query(
      `INSERT INTO tenant_modules (tenant_id, module_id, status, source)
       VALUES (1, $1, 'ACTIVE', 'PLAN')
       ON CONFLICT (tenant_id, module_id) DO UPDATE SET
         status = 'ACTIVE',
         updated_at = NOW()`,
      [moduleRow.id],
    );
  }

  return { modules: allModules.length };
}

module.exports = { migratePhase3Modules, MODULE_CATALOG };
