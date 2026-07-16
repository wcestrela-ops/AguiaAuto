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

  _buildListQuery(filters = {}) {
    const params = [];
    const conditions = [];
    let idx = 1;

    if (filters.action) {
      conditions.push(`action = $${idx++}`);
      params.push(filters.action);
    }
    if (filters.actor_type) {
      conditions.push(`actor_type = $${idx++}`);
      params.push(filters.actor_type);
    }
    if (filters.resource_type) {
      conditions.push(`resource_type = $${idx++}`);
      params.push(filters.resource_type);
    }
    if (filters.actor_id) {
      conditions.push(`actor_id = $${idx++}`);
      params.push(String(filters.actor_id));
    }
    if (filters.resource_id) {
      conditions.push(`resource_id = $${idx++}`);
      params.push(String(filters.resource_id));
    }
    if (filters.from) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`created_at <= $${idx++}`);
      params.push(filters.to);
    }
    if (filters.search) {
      conditions.push(`(
        action ILIKE $${idx}
        OR resource_type ILIKE $${idx}
        OR resource_id ILIKE $${idx}
        OR actor_id ILIKE $${idx}
        OR metadata::text ILIKE $${idx}
      )`);
      params.push(`%${filters.search}%`);
      idx += 1;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return { where, params, nextIdx: idx };
  }

  async list(filters = {}) {
    const limit = Math.min(Math.max(parseInt(filters.limit || '50', 10), 1), 200);
    const offset = Math.max(parseInt(filters.offset || '0', 10), 0);
    const { where, params, nextIdx } = this._buildListQuery(filters);

    params.push(limit, offset);
    const { rows } = await this.pool.query(
      `SELECT * FROM audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      params,
    );
    return rows;
  }

  async count(filters = {}) {
    const { where, params } = this._buildListQuery(filters);
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM audit_logs ${where}`,
      params,
    );
    return rows[0]?.count || 0;
  }

  async listDistinctActions() {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT action FROM audit_logs ORDER BY action ASC`,
    );
    return rows.map((row) => row.action);
  }

  async listDistinctResourceTypes() {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT resource_type FROM audit_logs
       WHERE resource_type IS NOT NULL
       ORDER BY resource_type ASC`,
    );
    return rows.map((row) => row.resource_type);
  }

  async listRecent(limit = 50) {
    return this.list({ limit });
  }
}

let instance = null;

function getAuditRepository() {
  if (!instance) instance = new AuditRepository();
  return instance;
}

module.exports = { AuditRepository, getAuditRepository };
