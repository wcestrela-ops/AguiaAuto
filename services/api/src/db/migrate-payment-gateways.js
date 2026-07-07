const { getPool } = require('./pool');

async function migratePaymentGateways() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mercadopago_payer_id VARCHAR(80);

    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(30) DEFAULT 'asaas';
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS mercadopago_subscription_id VARCHAR(80);
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS external_subscription_id VARCHAR(80);

    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(30) DEFAULT 'asaas';
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS external_payment_id VARCHAR(80);
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_initial_charge BOOLEAN NOT NULL DEFAULT false;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_external_payment
      ON invoices (payment_provider, external_payment_id)
      WHERE external_payment_id IS NOT NULL;

    UPDATE invoices
    SET external_payment_id = asaas_payment_id,
        payment_provider = 'asaas'
    WHERE external_payment_id IS NULL AND asaas_payment_id IS NOT NULL;

    UPDATE subscriptions
    SET external_subscription_id = asaas_subscription_id,
        payment_provider = 'asaas'
    WHERE external_subscription_id IS NULL AND asaas_subscription_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS payment_gateway_logs (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
      provider      VARCHAR(30) NOT NULL,
      operation     VARCHAR(50) NOT NULL,
      charge_type   VARCHAR(30),
      success       BOOLEAN NOT NULL,
      failover_used BOOLEAN NOT NULL DEFAULT false,
      error_message TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_payment_logs_user ON payment_gateway_logs (user_id);
    CREATE INDEX IF NOT EXISTS idx_payment_logs_provider ON payment_gateway_logs (provider);
  `);
}

module.exports = { migratePaymentGateways };
