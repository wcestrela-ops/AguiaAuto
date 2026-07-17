const { getPool } = require('../db/pool');
const { isMultiTenantEnabled, DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const { tenantWhereClause } = require('../lib/tenant/tenant-query');

class PlanRepository {
  constructor() {
    this.pool = getPool();
  }

  async listActive(tenantId = DEFAULT_TENANT_ID) {
    const params = [];
    let sql = `SELECT id, name, description, price_monthly, active, created_at, tenant_id
       FROM plans WHERE active = true`;
    if (isMultiTenantEnabled()) {
      const filter = tenantWhereClause(tenantId, { paramIndex: 1 });
      sql += filter.clause;
      params.push(...filter.params);
    }
    sql += ' ORDER BY price_monthly ASC';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listAll(tenantId = DEFAULT_TENANT_ID) {
    const params = [];
    let sql = 'SELECT * FROM plans';
    if (isMultiTenantEnabled()) {
      sql += ' WHERE tenant_id = $1';
      params.push(tenantId);
    }
    sql += ' ORDER BY price_monthly ASC';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async findById(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = 'SELECT * FROM plans WHERE id = $1';
    if (isMultiTenantEnabled()) {
      const filter = tenantWhereClause(tenantId, { paramIndex: 2 });
      sql += filter.clause;
      params.push(...filter.params);
    }
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async create(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO plans (name, description, price_monthly, active, tenant_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.name, data.description, data.price_monthly, data.active !== false, data.tenant_id ?? DEFAULT_TENANT_ID]
    );
    return rows[0];
  }

  async update(id, data) {
    const { rows } = await this.pool.query(
      `UPDATE plans SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        price_monthly = COALESCE($4, price_monthly),
        active = COALESCE($5, active)
       WHERE id = $1 RETURNING *`,
      [id, data.name, data.description, data.price_monthly, data.active]
    );
    return rows[0] || null;
  }
}

let instance = null;

function getPlanRepository() {
  if (!instance) instance = new PlanRepository();
  return instance;
}

module.exports = { PlanRepository, getPlanRepository };
