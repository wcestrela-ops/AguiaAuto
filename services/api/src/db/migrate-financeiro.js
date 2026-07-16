const { getPool } = require('./pool');

async function migrateFinanceiro() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(50);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS tracker_user_id VARCHAR(50);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS provisioning_status VARCHAR(30) NOT NULL DEFAULT 'pending';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS provisioning_errors JSONB DEFAULT '[]'::jsonb;

    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS asaas_subscription_id VARCHAR(50);
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_type VARCHAR(30) DEFAULT 'UNDEFINED';

    CREATE TABLE IF NOT EXISTS invoices (
      id                  SERIAL PRIMARY KEY,
      user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subscription_id     INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
      asaas_payment_id    VARCHAR(50) UNIQUE,
      description         VARCHAR(255),
      amount              DECIMAL(10,2) NOT NULL,
      due_date            DATE,
      status              VARCHAR(30) NOT NULL DEFAULT 'pending',
      billing_type        VARCHAR(30),
      invoice_url         TEXT,
      bank_slip_url       TEXT,
      pix_qrcode          TEXT,
      pix_copy_paste      TEXT,
      paid_at             TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices (user_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
    CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices (due_date);
    CREATE INDEX IF NOT EXISTS idx_users_asaas ON users (asaas_customer_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas ON subscriptions (asaas_subscription_id);
  `);
}

module.exports = { migrateFinanceiro };
