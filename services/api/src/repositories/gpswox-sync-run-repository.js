const { getPool } = require('../db/pool');

class GpswoxSyncRunRepository {
  constructor() {
    this.pool = getPool();
  }

  async startRun({ triggered_by = 'scheduler', dry_run = false, provider = 'gpswox' } = {}) {
    const { rows } = await this.pool.query(
      `INSERT INTO tracker_sync_runs (triggered_by, dry_run, provider, started_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [triggered_by, dry_run, provider],
    );
    return rows[0];
  }

  async finishRun(id, { summary, success = true, error_message = null } = {}) {
    const { rows } = await this.pool.query(
      `UPDATE tracker_sync_runs SET
        total = $2,
        created = $3,
        updated = $4,
        skipped = $5,
        errors = $6,
        error_message = $7,
        success = $8,
        finished_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        summary?.total ?? 0,
        summary?.created ?? 0,
        summary?.updated ?? 0,
        summary?.skipped ?? 0,
        JSON.stringify(summary?.errors || []),
        error_message,
        success,
      ],
    );
    return rows[0] || null;
  }

  async getLastRun({ successOnly = false, provider = null } = {}) {
    const params = [];
    const conditions = [];

    if (successOnly) {
      conditions.push('success = true', 'dry_run = false');
    }

    if (provider && provider !== 'all') {
      params.push(provider);
      conditions.push(`provider = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM tracker_sync_runs ${where} ORDER BY started_at DESC LIMIT 1`,
      params,
    );
    return rows[0] || null;
  }

  async listRecent(limit = 10) {
    const { rows } = await this.pool.query(
      `SELECT * FROM tracker_sync_runs
       ORDER BY started_at DESC
       LIMIT $1`,
      [Math.min(limit, 50)],
    );
    return rows;
  }

  async countUnlinkedFromLastRun(lastRun) {
    const run = lastRun || await this.getLastRun({ successOnly: true });
    if (!run?.errors) return 0;
    const errors = Array.isArray(run.errors) ? run.errors : [];
    return errors.filter((e) => e.reason?.includes('Cliente Águia não encontrado')).length;
  }
}

let instance = null;

function getGpswoxSyncRunRepository() {
  if (!instance) instance = new GpswoxSyncRunRepository();
  return instance;
}

module.exports = { GpswoxSyncRunRepository, getGpswoxSyncRunRepository };
