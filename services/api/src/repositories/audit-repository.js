const { getPool } = require('../db/pool');

class AuditRepository {
  constructor() {
    this.pool = getPool();
  }

  async create(entry) {
    const { rows } = await this.pool.query(
      `INSERT INTO audit_logs
        (actor_type, actor_id, action, resource_type, resource_id, metadata, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        entry.actor_type,
        entry.actor_id || null,
        entry.action,
        entry.resource_type || null,
        entry.resource_id || null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.ip_address || null,
      ],
    );
    return rows[0];
  }

  async listRecent(limit = 50) {
    const { rows } = await this.pool.query(
      `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }
}

let instance = null;

function getAuditRepository() {
  if (!instance) instance = new AuditRepository();
  return instance;
}

module.exports = { AuditRepository, getAuditRepository };
