const { getPool } = require('../db/pool');

const VEHICLE_STATUS = {
  PENDING_INSTALLATION: 'pending_installation',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
};

class VehicleRepository {
  constructor() {
    this.pool = getPool();
  }

  async listByUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT id, user_id, gpswox_device_id, gpswox_name, plate, brand, model, color, year, status, created_at, updated_at
       FROM vehicles WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await this.pool.query('SELECT * FROM vehicles WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByIdForUser(id, userId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM vehicles WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rows[0] || null;
  }

  async countActiveByUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vehicles
       WHERE user_id = $1 AND status IN ('active', 'blocked')`,
      [userId]
    );
    return rows[0].count;
  }

  async create(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO vehicles (user_id, gpswox_device_id, gpswox_name, plate, brand, model, color, year, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        data.user_id, data.gpswox_device_id, data.gpswox_name,
        data.plate, data.brand, data.model, data.color, data.year,
        data.status || VEHICLE_STATUS.PENDING_INSTALLATION,
      ]
    );
    return rows[0];
  }

  async update(id, data) {
    const current = await this.findById(id);
    if (!current) throw new Error('Veículo não encontrado.');

    const { rows } = await this.pool.query(
      `UPDATE vehicles SET
        gpswox_device_id = COALESCE($2, gpswox_device_id),
        gpswox_name = COALESCE($3, gpswox_name),
        plate = COALESCE($4, plate),
        brand = COALESCE($5, brand),
        model = COALESCE($6, model),
        color = COALESCE($7, color),
        year = COALESCE($8, year),
        status = COALESCE($9, status),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id, data.gpswox_device_id, data.gpswox_name, data.plate,
        data.brand, data.model, data.color, data.year, data.status,
      ]
    );
    return rows[0];
  }

  async listAll() {
    const { rows } = await this.pool.query(
      `SELECT v.*, u.email AS user_email, u.name AS user_name
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       ORDER BY v.created_at DESC`
    );
    return rows;
  }
}

let instance = null;

function getVehicleRepository() {
  if (!instance) instance = new VehicleRepository();
  return instance;
}

module.exports = { VehicleRepository, getVehicleRepository, VEHICLE_STATUS };
