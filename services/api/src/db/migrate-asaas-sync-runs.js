const { getPool } = require('./pool');

async function migrateAsaasSyncRuns() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS asaas_sync_runs (
      id                    SERIAL PRIMARY KEY,
      triggered_by          VARCHAR(20) NOT NULL DEFAULT 'admin',
      dry_run               BOOLEAN NOT NULL DEFAULT false,
      total_customers       INTEGER NOT NULL DEFAULT 0,
      users_created         INTEGER NOT NULL DEFAULT 0,
      users_linked          INTEGER NOT NULL DEFAULT 0,
      subscriptions_imported INTEGER NOT NULL DEFAULT 0,
      invoices_imported     INTEGER NOT NULL DEFAULT 0,
      skipped               INTEGER NOT NULL DEFAULT 0,
      errors                JSONB NOT NULL DEFAULT '[]',
      error_message         TEXT,
      success               BOOLEAN NOT NULL DEFAULT true,
      started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at           TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_asaas_sync_runs_started ON asaas_sync_runs (started_at DESC);
  `);
}

module.exports = { migrateAsaasSyncRuns };
