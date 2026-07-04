const { getPool } = require('./pool');

async function migratePasswordReset() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash   VARCHAR(255) NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      used        BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens (user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens (expires_at) WHERE used = false;
  `);
}

module.exports = { migratePasswordReset };
