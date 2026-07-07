const { getPool } = require('./pool');

async function migrateIndicacoes() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(12);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
      ON users (referral_code)
      WHERE referral_code IS NOT NULL;

    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10,2);
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_percent INTEGER;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS referral_id INTEGER;

    CREATE TABLE IF NOT EXISTS referrals (
      id                  SERIAL PRIMARY KEY,
      referrer_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      referral_code       VARCHAR(12) NOT NULL,
      discount_percent    INTEGER NOT NULL DEFAULT 50,
      discount_applied    BOOLEAN NOT NULL DEFAULT false,
      discount_invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
      discount_status     VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_user_id);
    CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals (discount_status);
  `);
}

module.exports = { migrateIndicacoes };
