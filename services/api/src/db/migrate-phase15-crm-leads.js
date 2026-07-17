const { getPool } = require('./pool');

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'];

async function migratePhase15CrmLeads() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_leads (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      name VARCHAR(200) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      source VARCHAR(100),
      status VARCHAR(50) NOT NULL DEFAULT 'NEW',
      notes TEXT,
      assigned_admin_id INTEGER,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant ON crm_leads (tenant_id);
    CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant_status ON crm_leads (tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_crm_leads_created ON crm_leads (tenant_id, created_at DESC);
  `);

  return { crm_leads: true, statuses: LEAD_STATUSES };
}

module.exports = { migratePhase15CrmLeads, LEAD_STATUSES };
