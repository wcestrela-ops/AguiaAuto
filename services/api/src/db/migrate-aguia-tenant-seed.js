const { getPool } = require('./pool');

async function migrateAguiaTenantSeed() {
  const pool = getPool();

  await pool.query(`
    INSERT INTO tenants (id, name, slug, legal_name, trade_name, status, active)
    VALUES (
      1,
      'Águia Gestão Veicular',
      'aguia',
      'Águia Gestão Veicular Ltda',
      'Águia Gestão Veicular',
      'ACTIVE',
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      legal_name = COALESCE(tenants.legal_name, EXCLUDED.legal_name),
      trade_name = COALESCE(tenants.trade_name, EXCLUDED.trade_name),
      status = COALESCE(tenants.status, EXCLUDED.status),
      active = true,
      updated_at = NOW();
  `);

  const tables = [
    'users',
    'vehicles',
    'invoices',
    'subscriptions',
    'plans',
    'site_content',
    'integration_configs',
    'audit_logs',
  ];

  for (const table of tables) {
    await pool.query(`
      UPDATE ${table}
      SET tenant_id = 1
      WHERE tenant_id IS NULL OR tenant_id = 0;
    `);
  }

  const counts = {};
  for (const table of ['users', 'vehicles', 'invoices', 'subscriptions']) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM ${table} WHERE tenant_id = 1`,
    );
    counts[table] = rows[0]?.count ?? 0;
  }

  return { tenant_id: 1, slug: 'aguia', counts };
}

module.exports = { migrateAguiaTenantSeed };
