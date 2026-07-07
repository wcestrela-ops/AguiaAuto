const { getPool } = require('../db/pool');

class PlanRepository {
  constructor() {
    this.pool = getPool();
  }

  async listActive() {
    const { rows } = await this.pool.query(
      `SELECT id, name, description, price_monthly, active, created_at
       FROM plans WHERE active = true ORDER BY price_monthly ASC`
    );
    return rows;
  }

  async listAll() {
    const { rows } = await this.pool.query(
      'SELECT * FROM plans ORDER BY price_monthly ASC'
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await this.pool.query('SELECT * FROM plans WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async create(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO plans (name, description, price_monthly, active)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.name, data.description, data.price_monthly, data.active !== false]
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
