const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const {
  sqlAndTenant,
  tenantIdForInsert,
} = require('../lib/tenant/repository-tenant');

class CrmLeadRepository {
  constructor() {
    this.pool = getPool();
  }

  async findById(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = 'SELECT * FROM crm_leads WHERE id = $1';
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async listAll(tenantId = DEFAULT_TENANT_ID, { status, limit = 50, offset = 0 } = {}) {
    const params = [];
    let sql = 'SELECT * FROM crm_leads WHERE 1=1';
    const tenant = sqlAndTenant(tenantId, 1);
    if (tenant.clause) {
      sql += tenant.clause;
      params.push(...tenant.params);
    }

    if (status) {
      params.push(String(status).toUpperCase());
      sql += ` AND status = $${params.length}`;
    }

    params.push(Math.min(Math.max(limit, 1), 200));
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    params.push(Math.max(offset, 0));
    sql += ` OFFSET $${params.length}`;

    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async create(data, tenantId = DEFAULT_TENANT_ID) {
    const tid = tenantIdForInsert(data, tenantId);
    const { rows } = await this.pool.query(
      `INSERT INTO crm_leads (
        tenant_id, name, email, phone, source, status, notes, assigned_admin_id, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
      RETURNING *`,
      [
        tid,
        data.name,
        data.email || null,
        data.phone || null,
        data.source || null,
        data.status || 'NEW',
        data.notes || null,
        data.assigned_admin_id || null,
        JSON.stringify(data.metadata || {}),
      ],
    );
    return rows[0];
  }

  async update(id, data, tenantId = DEFAULT_TENANT_ID) {
    const existing = await this.findById(id, tenantId);
    if (!existing) return null;

    const { rows } = await this.pool.query(
      `UPDATE crm_leads SET
        name = COALESCE($3, name),
        email = COALESCE($4, email),
        phone = COALESCE($5, phone),
        source = COALESCE($6, source),
        status = COALESCE($7, status),
        notes = COALESCE($8, notes),
        assigned_admin_id = COALESCE($9, assigned_admin_id),
        metadata = COALESCE($10::jsonb, metadata),
        updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [
        id,
        tenantId,
        data.name,
        data.email,
        data.phone,
        data.source,
        data.status,
        data.notes,
        data.assigned_admin_id,
        data.metadata != null ? JSON.stringify(data.metadata) : null,
      ],
    );
    return rows[0] || null;
  }

  async delete(id, tenantId = DEFAULT_TENANT_ID) {
    const existing = await this.findById(id, tenantId);
    if (!existing) return false;
    await this.pool.query('DELETE FROM crm_leads WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    return true;
  }
}

let instance = null;

function getCrmLeadRepository() {
  if (!instance) instance = new CrmLeadRepository();
  return instance;
}

module.exports = { CrmLeadRepository, getCrmLeadRepository };
