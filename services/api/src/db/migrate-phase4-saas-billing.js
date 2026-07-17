const { getPool } = require('./pool');

const DEFAULT_SAAS_PLAN = {
  code: 'aguia-completo',
  name: 'Águia Completo',
  description: 'Plano enterprise com todos os módulos — tenant inicial',
  billing_cycle: 'MONTHLY',
  trial_days: 0,
  price_monthly: 0,
};

const DEFAULT_USAGE_LIMITS = {
  max_users: 500,
  max_customers: 50000,
  max_vehicles: 50000,
  max_trackers: 50000,
  max_whatsapp_messages: 100000,
  max_sms_messages: 50000,
  max_api_requests: 1000000,
  storage_limit_mb: 102400,
};

async function migratePhase4SaasBilling() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS saas_plans (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(150) NOT NULL,
      description TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      billing_cycle VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
      trial_days INTEGER NOT NULL DEFAULT 14,
      price_monthly DECIMAL(12,2) NOT NULL DEFAULT 0,
      price_quarterly DECIMAL(12,2),
      price_semiannual DECIMAL(12,2),
      price_annual DECIMAL(12,2),
      currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS saas_plan_modules (
      plan_id INTEGER NOT NULL REFERENCES saas_plans(id) ON DELETE CASCADE,
      module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      included BOOLEAN NOT NULL DEFAULT true,
      limits JSONB NOT NULL DEFAULT '{}',
      PRIMARY KEY (plan_id, module_id)
    );

    CREATE TABLE IF NOT EXISTS module_prices (
      id SERIAL PRIMARY KEY,
      module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      billing_cycle VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
      pricing_model VARCHAR(30) NOT NULL DEFAULT 'FIXED',
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
      per_unit_label VARCHAR(50),
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (module_id, billing_cycle, pricing_model)
    );

    CREATE TABLE IF NOT EXISTS tenant_saas_subscriptions (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      plan_id INTEGER REFERENCES saas_plans(id) ON DELETE SET NULL,
      provider VARCHAR(30) NOT NULL DEFAULT 'manual',
      provider_subscription_id VARCHAR(120),
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      billing_cycle VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
      current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      current_period_end TIMESTAMPTZ,
      trial_ends_at TIMESTAMPTZ,
      canceled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_saas_sub_active
      ON tenant_saas_subscriptions (tenant_id)
      WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE');

    CREATE TABLE IF NOT EXISTS tenant_usage_limits (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
      limits JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tenant_usage_metrics (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
      metrics JSONB NOT NULL DEFAULT '{}',
      measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_saas_plans_status ON saas_plans (status);
    CREATE INDEX IF NOT EXISTS idx_tenant_saas_sub_tenant ON tenant_saas_subscriptions (tenant_id, status);
  `);

  const { rows: planRows } = await pool.query(
    `INSERT INTO saas_plans (code, name, description, status, billing_cycle, trial_days, price_monthly)
     VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6)
     ON CONFLICT (code) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       updated_at = NOW()
     RETURNING id`,
    [
      DEFAULT_SAAS_PLAN.code,
      DEFAULT_SAAS_PLAN.name,
      DEFAULT_SAAS_PLAN.description,
      DEFAULT_SAAS_PLAN.billing_cycle,
      DEFAULT_SAAS_PLAN.trial_days,
      DEFAULT_SAAS_PLAN.price_monthly,
    ],
  );
  const planId = planRows[0].id;

  const { rows: modules } = await pool.query(`SELECT id, code FROM modules WHERE status = 'ACTIVE'`);
  for (const mod of modules) {
    await pool.query(
      `INSERT INTO saas_plan_modules (plan_id, module_id, included)
       VALUES ($1, $2, true)
       ON CONFLICT (plan_id, module_id) DO NOTHING`,
      [planId, mod.id],
    );

    await pool.query(
      `INSERT INTO module_prices (module_id, billing_cycle, pricing_model, amount, per_unit_label)
       VALUES ($1, 'MONTHLY', 'FIXED', 0, NULL)
       ON CONFLICT (module_id, billing_cycle, pricing_model) DO NOTHING`,
      [mod.id],
    );
  }

  await pool.query(
    `INSERT INTO tenant_saas_subscriptions (
      tenant_id, plan_id, provider, status, billing_cycle,
      current_period_start, current_period_end
    ) VALUES (1, $1, 'manual', 'ACTIVE', 'MONTHLY', NOW(), NOW() + INTERVAL '10 years')
    ON CONFLICT DO NOTHING`,
    [planId],
  );

  const existingSub = await pool.query(
    `SELECT id FROM tenant_saas_subscriptions WHERE tenant_id = 1 AND status IN ('TRIAL','ACTIVE','PAST_DUE') LIMIT 1`,
  );
  if (existingSub.rows.length === 0) {
    await pool.query(
      `INSERT INTO tenant_saas_subscriptions (
        tenant_id, plan_id, provider, status, billing_cycle,
        current_period_start, current_period_end
      ) VALUES (1, $1, 'manual', 'ACTIVE', 'MONTHLY', NOW(), NOW() + INTERVAL '10 years')`,
      [planId],
    );
  }

  await pool.query(
    `INSERT INTO tenant_usage_limits (tenant_id, limits)
     VALUES (1, $2::jsonb)
     ON CONFLICT (tenant_id) DO UPDATE SET
       limits = tenant_usage_limits.limits || EXCLUDED.limits,
       updated_at = NOW()`,
    [1, JSON.stringify(DEFAULT_USAGE_LIMITS)],
  );

  return { plan_id: planId, modules_linked: modules.length };
}

module.exports = {
  migratePhase4SaasBilling,
  DEFAULT_SAAS_PLAN,
  DEFAULT_USAGE_LIMITS,
};
