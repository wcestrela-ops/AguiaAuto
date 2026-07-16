const { getPool } = require('../db/pool');

class AsaasSyncRunRepository {
  constructor() {
    this.pool = getPool();
  }

  async startRun({ triggered_by = 'admin', dry_run = false } = {}) {
    const { rows } = await this.pool.query(
      `INSERT INTO asaas_sync_runs (triggered_by, dry_run, started_at)
       VALUES ($1, $2, NOW())
       RETURNING *`,
      [triggered_by, dry_run],
    );
    return rows[0];
  }

  async finishRun(id, { summary, success = true, error_message = null } = {}) {
    const { rows } = await this.pool.query(
      `UPDATE asaas_sync_runs SET
        total_customers = $2,
        users_created = $3,
        users_linked = $4,
        subscriptions_imported = $5,
        invoices_imported = $6,
        skipped = $7,
        errors = $8,
        error_message = $9,
        success = $10,
        finished_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        summary?.total_customers ?? 0,
        summary?.users_created ?? 0,
        summary?.users_linked ?? 0,
        summary?.subscriptions_imported ?? 0,
        summary?.invoices_imported ?? 0,
        summary?.skipped ?? 0,
        JSON.stringify(summary?.errors || []),
        error_message,
        success,
      ],
    );
    return rows[0] || null;
  }

  async getLastRun({ successOnly = false } = {}) {
    const conditions = successOnly ? 'WHERE success = true AND dry_run = false' : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM asaas_sync_runs ${conditions} ORDER BY started_at DESC LIMIT 1`,
    );
    return rows[0] || null;
  }

  async listRecent(limit = 10) {
    const { rows } = await this.pool.query(
      `SELECT * FROM asaas_sync_runs ORDER BY started_at DESC LIMIT $1`,
      [Math.min(limit, 50)],
    );
    return rows;
  }
}

let instance = null;

function getAsaasSyncRunRepository() {
  if (!instance) instance = new AsaasSyncRunRepository();
  return instance;
}

module.exports = { AsaasSyncRunRepository, getAsaasSyncRunRepository };
