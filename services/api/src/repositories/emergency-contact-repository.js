const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const {
  sqlAndTenant,
  tenantIdForInsert,
} = require('../lib/tenant/repository-tenant');

class EmergencyContactRepository {
  constructor() {
    this.pool = getPool();
  }

  async listByUser(userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId];
    let sql = `SELECT * FROM user_emergency_contacts
       WHERE user_id = $1`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY sort_order ASC, id ASC';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async replaceForUser(userId, contacts = [], tenantId = DEFAULT_TENANT_ID) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const deleteParams = [userId];
      let deleteSql = 'DELETE FROM user_emergency_contacts WHERE user_id = $1';
      const tenant = sqlAndTenant(tenantId, 2);
      deleteSql += tenant.clause;
      deleteParams.push(...tenant.params);
      await client.query(deleteSql, deleteParams);

      const saved = [];
      for (let i = 0; i < contacts.length; i += 1) {
        const contact = contacts[i];
        const tid = tenantIdForInsert(contact, tenantId);
        const { rows } = await client.query(
          `INSERT INTO user_emergency_contacts (tenant_id, user_id, name, phone, sort_order)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [tid, userId, contact.name, contact.phone, i],
        );
        saved.push(rows[0]);
      }

      await client.query('COMMIT');
      return saved;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

let instance = null;

function getEmergencyContactRepository() {
  if (!instance) instance = new EmergencyContactRepository();
  return instance;
}

module.exports = { EmergencyContactRepository, getEmergencyContactRepository };
