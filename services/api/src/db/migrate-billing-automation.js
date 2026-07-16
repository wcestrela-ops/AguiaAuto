const { getPool } = require('./pool');

async function migrateBillingAutomation() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS manual_payment_notes TEXT,
      ADD COLUMN IF NOT EXISTS paid_via VARCHAR(30);

    ALTER TABLE billing_notifications
      ADD COLUMN IF NOT EXISTS reminder_offset_days INTEGER,
      ADD COLUMN IF NOT EXISTS consolidated_invoice_ids JSONB;

    DROP INDEX IF EXISTS idx_billing_notifications_invoice_trigger;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_notifications_user_trigger_day
      ON billing_notifications (user_id, trigger, ((created_at AT TIME ZONE 'UTC')::date))
      WHERE user_id IS NOT NULL
        AND trigger LIKE 'billing.reminder.d%'
        AND status = 'sent';

    CREATE TABLE IF NOT EXISTS billing_reminder_runs (
      id                SERIAL PRIMARY KEY,
      started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at       TIMESTAMPTZ,
      reminders_sent    INTEGER NOT NULL DEFAULT 0,
      errors_count      INTEGER NOT NULL DEFAULT 0,
      details           JSONB DEFAULT '[]'::jsonb,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

module.exports = { migrateBillingAutomation };
