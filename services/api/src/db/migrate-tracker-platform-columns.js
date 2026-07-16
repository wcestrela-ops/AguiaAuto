const { getPool } = require('./pool');

async function columnExists(pool, table, column) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return rows.length > 0;
}

async function tableExists(pool, table) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return rows.length > 0;
}

async function renameColumnIfNeeded(pool, table, from, to) {
  if (!(await columnExists(pool, table, from))) return false;
  if (await columnExists(pool, table, to)) return false;
  await pool.query(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`);
  return true;
}

async function renameIndexIfNeeded(pool, from, to) {
  const { rows } = await pool.query(
    `SELECT 1 FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'i' AND c.relname = $1 AND n.nspname = 'public'`,
    [from],
  );
  if (!rows.length) return;
  const { rows: exists } = await pool.query(
    `SELECT 1 FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'i' AND c.relname = $1 AND n.nspname = 'public'`,
    [to],
  );
  if (exists.length) return;
  await pool.query(`ALTER INDEX ${from} RENAME TO ${to}`);
}

async function migrateTrackerPlatformColumns() {
  const pool = getPool();

  await renameColumnIfNeeded(pool, 'users', 'gpswox_user_id', 'tracker_user_id');
  await renameColumnIfNeeded(pool, 'vehicles', 'gpswox_device_id', 'tracker_device_id');
  await renameColumnIfNeeded(pool, 'vehicles', 'gpswox_name', 'tracker_name');
  await renameColumnIfNeeded(pool, 'vehicles', 'gpswox_synced_at', 'tracker_synced_at');
  await renameColumnIfNeeded(pool, 'installation_logs', 'gpswox_device_id', 'tracker_device_id');

  await renameIndexIfNeeded(pool, 'idx_vehicles_device', 'idx_vehicles_tracker_device');
  await renameIndexIfNeeded(pool, 'idx_vehicles_gpswox_device', 'idx_vehicles_tracker_device');

  const hasLegacySyncRuns = await tableExists(pool, 'gpswox_sync_runs');
  const hasTrackerSyncRuns = await tableExists(pool, 'tracker_sync_runs');
  if (hasLegacySyncRuns && !hasTrackerSyncRuns) {
    await pool.query('ALTER TABLE gpswox_sync_runs RENAME TO tracker_sync_runs');
    await renameIndexIfNeeded(pool, 'idx_gpswox_sync_runs_started', 'idx_tracker_sync_runs_started');
  }
}

module.exports = { migrateTrackerPlatformColumns };
