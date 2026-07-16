const { getPool } = require('../db/pool');

class GpswoxSyncRunRepository {
  constructor() {
    this.pool = getPool();
  }

  async startRun({ triggered_by = 'scheduler', dry_run = false } = {}) {
    const { rows } = await this.pool.query(
      `INSERT INTO tracker_sync_runs (triggered_by, dry_run, started_at)
       VALUES ($1, $2, NOW())
       RETURNING *`,
      [triggered_by, dry_run],
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

  async getLastRun({ successOnly = false } = {}) {
    const sql = `
      SELECT * FROM tracker_sync_runs
      ${successOnly ? "WHERE success = true AND dry_run = false" : ''}
      ORDER BY started_at DESC
      LIMIT 1`;
    const { rows } = await this.pool.query(sql);
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

  async countUnlinkedFromLastRun() {
    const last = await this.getLastRun({ successOnly: true });
    if (!last?.errors) return 0;
    const errors = Array.isArray(last.errors) ? last.errors : [];
    return errors.filter((e) => e.reason?.includes('Cliente Águia não encontrado')).length;
  }
}

let instance = null;

function getGpswoxSyncRunRepository() {
  if (!instance) instance = new GpswoxSyncRunRepository();
  return instance;
}

module.exports = { GpswoxSyncRunRepository, getGpswoxSyncRunRepository };
