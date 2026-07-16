const { getPool } = require('./pool');

async function migrateAdminAudit() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id              SERIAL PRIMARY KEY,
      actor_type      VARCHAR(20) NOT NULL,
      actor_id        VARCHAR(100),
      action          VARCHAR(100) NOT NULL,
      resource_type   VARCHAR(50),
      resource_id     VARCHAR(100),
      metadata        JSONB,
      ip_address      VARCHAR(45),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
  `);
}

module.exports = { migrateAdminAudit };
