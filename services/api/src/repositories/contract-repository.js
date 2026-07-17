const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const {
  sqlAndTenant,
  appendTenantConditions,
  tenantIdForInsert,
} = require('../lib/tenant/repository-tenant');

class ContractRepository {
  constructor() {
    this.pool = getPool();
  }

  async findTemplateBySlug(slug, tenantId = DEFAULT_TENANT_ID) {
    const params = [slug];
    let sql = 'SELECT * FROM contract_templates WHERE slug = $1 AND active = true';
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async listTemplates(tenantId = DEFAULT_TENANT_ID) {
    const params = [];
    const conditions = ['active = true'];
    let idx = 1;
    idx = appendTenantConditions(conditions, params, idx, tenantId);
    const { rows } = await this.pool.query(
      `SELECT * FROM contract_templates WHERE ${conditions.join(' AND ')} ORDER BY slug`,
      params,
    );
    return rows;
  }

  async updateTemplate(slug, { title, body_html }, tenantId = DEFAULT_TENANT_ID) {
    const params = [slug, title, body_html];
    let sql = `UPDATE contract_templates SET
        title = COALESCE($2, title),
        body_html = COALESCE($3, body_html),
        version = version + 1,
        updated_at = NOW()
       WHERE slug = $1 AND active = true`;
    const tenant = sqlAndTenant(tenantId, 4);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' RETURNING *';
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async findAcceptanceById(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = `SELECT ca.*, ct.slug, ct.title AS template_title
       FROM contract_acceptances ca
       JOIN contract_templates ct ON ct.id = ca.template_id
       WHERE ca.id = $1`;
    const tenant = sqlAndTenant(tenantId, 2, { alias: 'ca' });
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async findAcceptanceByUserAndType(userId, acceptanceType, { vehicleId, installationLogId, tenantId = DEFAULT_TENANT_ID } = {}) {
    let query = `
      SELECT ca.*, ct.slug, ct.title
      FROM contract_acceptances ca
      JOIN contract_templates ct ON ct.id = ca.template_id
      WHERE ca.user_id = $1 AND ca.acceptance_type = $2`;
    const params = [userId, acceptanceType];
    let idx = 3;

    if (acceptanceType === 'service') {
      // no extra filter
    } else if (installationLogId) {
      query += ` AND ca.installation_log_id = $${idx++}`;
      params.push(installationLogId);
    } else if (vehicleId) {
      query += ` AND ca.vehicle_id = $${idx++}`;
      params.push(vehicleId);
    }

    const tenant = sqlAndTenant(tenantId, idx, { alias: 'ca' });
    query += tenant.clause;
    params.push(...tenant.params);

    if (acceptanceType === 'service') {
      query += ' LIMIT 1';
    }

    const { rows } = await this.pool.query(query, params);
    return rows[0] || null;
  }

  async hasServiceAcceptance(userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId];
    let sql = `SELECT 1 FROM contract_acceptances
       WHERE user_id = $1 AND acceptance_type = 'service'`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' LIMIT 1';
    const { rows } = await this.pool.query(sql, params);
    return rows.length > 0;
  }

  async hasDeliveryAcceptance(userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId];
    let sql = `SELECT 1 FROM contract_acceptances
       WHERE user_id = $1 AND acceptance_type = 'installation_delivery'`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' LIMIT 1';
    const { rows } = await this.pool.query(sql, params);
    return rows.length > 0;
  }

  async createAcceptance(data, tenantId = DEFAULT_TENANT_ID) {
    const tid = tenantIdForInsert(data, tenantId);
    const { rows } = await this.pool.query(
      `INSERT INTO contract_acceptances
        (user_id, tenant_id, vehicle_id, template_id, template_version, acceptance_type,
         installation_log_id, ip_address, user_agent, snapshot_html)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        data.user_id,
        tid,
        data.vehicle_id || null,
        data.template_id,
        data.template_version,
        data.acceptance_type,
        data.installation_log_id || null,
        data.ip_address || null,
        data.user_agent || null,
        data.snapshot_html || null,
      ]
    );
    return rows[0];
  }

  async listPendingDeliveriesForUser(userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId];
    let sql = `SELECT il.*, v.plate, v.brand, v.model, v.user_id, i.name AS installer_name,
              ca.id AS acceptance_id
       FROM installation_logs il
       JOIN vehicles v ON v.id = il.vehicle_id
       JOIN users i ON i.id = il.installer_id
       LEFT JOIN contract_acceptances ca
         ON ca.installation_log_id = il.id
        AND ca.acceptance_type = 'installation_delivery'
        AND ca.user_id = $1
       WHERE v.user_id = $1 AND ca.id IS NULL`;
    const tenant = sqlAndTenant(tenantId, 2, { alias: 'il' });
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY il.created_at DESC';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listAcceptedDeliveriesForUser(userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId];
    let sql = `SELECT il.*, v.plate, v.brand, v.model, i.name AS installer_name,
              ca.accepted_at, ca.id AS acceptance_id, ca.snapshot_html
       FROM contract_acceptances ca
       JOIN installation_logs il ON il.id = ca.installation_log_id
       JOIN vehicles v ON v.id = il.vehicle_id
       JOIN users i ON i.id = il.installer_id
       WHERE ca.user_id = $1 AND ca.acceptance_type = 'installation_delivery'`;
    const tenant = sqlAndTenant(tenantId, 2, { alias: 'ca' });
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY ca.accepted_at DESC';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listAllAcceptances({ limit = 200, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [limit];
    const conditions = [];
    let idx = 2;
    idx = appendTenantConditions(conditions, params, idx, tenantId, { alias: 'ca' });
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT ca.*, u.email AS user_email, u.name AS user_name,
              ct.slug AS template_slug, ct.title AS template_title,
              v.plate AS vehicle_plate
       FROM contract_acceptances ca
       JOIN users u ON u.id = ca.user_id
       JOIN contract_templates ct ON ct.id = ca.template_id
       LEFT JOIN vehicles v ON v.id = ca.vehicle_id
       ${where}
       ORDER BY ca.accepted_at DESC
       LIMIT $1`,
      params
    );
    return rows;
  }
}

let instance = null;

function getContractRepository() {
  if (!instance) instance = new ContractRepository();
  return instance;
}

module.exports = { ContractRepository, getContractRepository };
