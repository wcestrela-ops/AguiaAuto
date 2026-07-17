const { getPool } = require('./pool');

const TENANT_SCOPED_TABLES = [
  'alert_events',
  'alert_preferences',
  'contract_templates',
  'contract_acceptances',
  'installation_logs',
  'installation_photos',
  'vehicle_anchors',
  'vehicle_command_logs',
  'billing_notifications',
  'billing_reminder_runs',
  'referrals',
  'user_emergency_contacts',
  'emergency_events',
  'vehicle_documents',
  'vehicle_maintenance_records',
  'fleet_reminder_notifications',
  'fleet_reminder_runs',
  'webhook_events',
  'fcm_tokens',
  'password_reset_tokens',
  'lgpd_consents',
];

async function migratePhase2TenantTables() {
  const pool = getPool();

  for (const table of TENANT_SCOPED_TABLES) {
    await pool.query(`
      ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_${table}_tenant_id ON ${table} (tenant_id);
    `);
  }

  await pool.query(`
    UPDATE alert_events ae
    SET tenant_id = u.tenant_id
    FROM users u
    WHERE ae.user_id = u.id AND ae.tenant_id IS DISTINCT FROM u.tenant_id;
  `);

  await pool.query(`
    UPDATE contract_acceptances ca
    SET tenant_id = u.tenant_id
    FROM users u
    WHERE ca.user_id = u.id AND ca.tenant_id IS DISTINCT FROM u.tenant_id;
  `);

  await pool.query(`
    UPDATE installation_logs il
    SET tenant_id = u.tenant_id
    FROM users u
    WHERE il.user_id = u.id AND il.tenant_id IS DISTINCT FROM u.tenant_id;
  `);

  await pool.query(`
    UPDATE vehicle_documents vd
    SET tenant_id = v.tenant_id
    FROM vehicles v
    WHERE vd.vehicle_id = v.id AND vd.tenant_id IS DISTINCT FROM v.tenant_id;
  `);

  await pool.query(`
    UPDATE vehicle_maintenance_records vm
    SET tenant_id = v.tenant_id
    FROM vehicles v
    WHERE vm.vehicle_id = v.id AND vm.tenant_id IS DISTINCT FROM v.tenant_id;
  `);

  await pool.query(`
    UPDATE vehicle_anchors va
    SET tenant_id = v.tenant_id
    FROM vehicles v
    WHERE va.vehicle_id = v.id AND va.tenant_id IS DISTINCT FROM v.tenant_id;
  `);

  await pool.query(`
    UPDATE vehicle_command_logs vcl
    SET tenant_id = v.tenant_id
    FROM vehicles v
    WHERE vcl.vehicle_id = v.id AND vcl.tenant_id IS DISTINCT FROM v.tenant_id;
  `);
}

module.exports = { migratePhase2TenantTables, TENANT_SCOPED_TABLES };
