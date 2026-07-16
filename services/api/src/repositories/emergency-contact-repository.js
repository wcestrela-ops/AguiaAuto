const { getPool } = require('../db/pool');

class EmergencyContactRepository {
  constructor() {
    this.pool = getPool();
  }

  async listByUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM user_emergency_contacts
       WHERE user_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [userId],
    );
    return rows;
  }

  async replaceForUser(userId, contacts = []) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM user_emergency_contacts WHERE user_id = $1', [userId]);

      const saved = [];
      for (let i = 0; i < contacts.length; i += 1) {
        const contact = contacts[i];
        const { rows } = await client.query(
          `INSERT INTO user_emergency_contacts (user_id, name, phone, sort_order)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [userId, contact.name, contact.phone, i],
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
