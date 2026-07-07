const { getPool } = require('../db/pool');

class ContractRepository {
  constructor() {
    this.pool = getPool();
  }

  async findTemplateBySlug(slug) {
    const { rows } = await this.pool.query(
      'SELECT * FROM contract_templates WHERE slug = $1 AND active = true',
      [slug]
    );
    return rows[0] || null;
  }

  async findAcceptanceByUserAndType(userId, acceptanceType, { vehicleId, installationLogId } = {}) {
    let query = `
      SELECT ca.*, ct.slug, ct.title
      FROM contract_acceptances ca
      JOIN contract_templates ct ON ct.id = ca.template_id
      WHERE ca.user_id = $1 AND ca.acceptance_type = $2`;
    const params = [userId, acceptanceType];

    if (acceptanceType === 'service') {
      query += ' LIMIT 1';
    } else if (installationLogId) {
      query += ' AND ca.installation_log_id = $3';
      params.push(installationLogId);
    } else if (vehicleId) {
      query += ' AND ca.vehicle_id = $3';
      params.push(vehicleId);
    }

    const { rows } = await this.pool.query(query, params);
    return rows[0] || null;
  }

  async hasServiceAcceptance(userId) {
    const { rows } = await this.pool.query(
      `SELECT 1 FROM contract_acceptances
       WHERE user_id = $1 AND acceptance_type = 'service' LIMIT 1`,
      [userId]
    );
    return rows.length > 0;
  }

  async createAcceptance(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO contract_acceptances
        (user_id, vehicle_id, template_id, template_version, acceptance_type,
         installation_log_id, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        data.user_id,
        data.vehicle_id || null,
        data.template_id,
        data.template_version,
        data.acceptance_type,
        data.installation_log_id || null,
        data.ip_address || null,
        data.user_agent || null,
      ]
    );
    return rows[0];
  }

  async listPendingDeliveriesForUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT il.*, v.plate, v.brand, v.model, i.name AS installer_name,
              ca.id AS acceptance_id
       FROM installation_logs il
       JOIN vehicles v ON v.id = il.vehicle_id
       JOIN users i ON i.id = il.installer_id
       LEFT JOIN contract_acceptances ca
         ON ca.installation_log_id = il.id
        AND ca.acceptance_type = 'installation_delivery'
        AND ca.user_id = $1
       WHERE v.user_id = $1 AND ca.id IS NULL
       ORDER BY il.created_at DESC`,
      [userId]
    );
    return rows;
  }

  async listAcceptedDeliveriesForUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT il.*, v.plate, v.brand, v.model, i.name AS installer_name,
              ca.accepted_at, ca.id AS acceptance_id
       FROM contract_acceptances ca
       JOIN installation_logs il ON il.id = ca.installation_log_id
       JOIN vehicles v ON v.id = il.vehicle_id
       JOIN users i ON i.id = il.installer_id
       WHERE ca.user_id = $1 AND ca.acceptance_type = 'installation_delivery'
       ORDER BY ca.accepted_at DESC`,
      [userId]
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
