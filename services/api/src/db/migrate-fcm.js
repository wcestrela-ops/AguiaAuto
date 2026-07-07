const { getPool } = require('./pool');

async function migrateFcmTokens() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fcm_tokens (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token         VARCHAR(512) NOT NULL,
      device_name   VARCHAR(200),
      platform      VARCHAR(50) DEFAULT 'web',
      active        BOOLEAN NOT NULL DEFAULT true,
      last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, token)
    );

    CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON fcm_tokens (user_id) WHERE active = true;
    CREATE INDEX IF NOT EXISTS idx_fcm_tokens_token ON fcm_tokens (token);
  `);
}

module.exports = { migrateFcmTokens };
