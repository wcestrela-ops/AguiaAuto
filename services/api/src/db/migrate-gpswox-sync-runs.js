const { getPool } = require('./pool');

async function tableExists(pool, table) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return rows.length > 0;
}

async function migrateGpswoxSyncRuns() {
  const pool = getPool();

  const hasTracker = await tableExists(pool, 'tracker_sync_runs');
  if (hasTracker) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gpswox_sync_runs (
      id              SERIAL PRIMARY KEY,
      triggered_by    VARCHAR(20) NOT NULL DEFAULT 'scheduler',
      dry_run         BOOLEAN NOT NULL DEFAULT false,
      total           INTEGER NOT NULL DEFAULT 0,
      created         INTEGER NOT NULL DEFAULT 0,
      updated         INTEGER NOT NULL DEFAULT 0,
      skipped         INTEGER NOT NULL DEFAULT 0,
      errors          JSONB NOT NULL DEFAULT '[]',
      error_message   TEXT,
      success         BOOLEAN NOT NULL DEFAULT true,
      started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at     TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_gpswox_sync_runs_started ON gpswox_sync_runs (started_at DESC);
  `);
}

module.exports = { migrateGpswoxSyncRuns };
