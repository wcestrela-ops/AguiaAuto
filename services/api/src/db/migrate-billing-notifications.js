const { getPool } = require('./pool');

async function migrateBillingNotifications() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_notifications (
      id              SERIAL PRIMARY KEY,
      invoice_id      INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
      user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
      phone           VARCHAR(30) NOT NULL,
      channel         VARCHAR(20) NOT NULL,
      used_fallback   BOOLEAN NOT NULL DEFAULT false,
      status          VARCHAR(30) NOT NULL DEFAULT 'sent',
      trigger         VARCHAR(40) NOT NULL DEFAULT 'billing.reminder',
      provider_type   VARCHAR(40),
      external_ref    VARCHAR(100),
      error_message   TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_billing_notifications_invoice
      ON billing_notifications (invoice_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_billing_notifications_user
      ON billing_notifications (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_billing_notifications_created
      ON billing_notifications (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_billing_notifications_channel
      ON billing_notifications (channel, used_fallback, created_at DESC);
  `);
}

module.exports = { migrateBillingNotifications };
