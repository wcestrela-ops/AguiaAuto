const { getPool } = require('../db/pool');

class VehicleDocumentRepository {
  constructor() {
    this.pool = getPool();
  }

  async listByUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT d.*, v.plate, v.brand, v.model
       FROM vehicle_documents d
       JOIN vehicles v ON v.id = d.vehicle_id
       WHERE d.user_id = $1
       ORDER BY d.expiry_date ASC NULLS LAST, d.created_at DESC`,
      [userId],
    );
    return rows;
  }

  async listByVehicle(vehicleId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM vehicle_documents
       WHERE vehicle_id = $1
       ORDER BY expiry_date ASC NULLS LAST, created_at DESC`,
      [vehicleId],
    );
    return rows;
  }

  async listAll({ limit = 200 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT d.*, v.plate, v.brand, v.model, u.name AS user_name, u.email AS user_email
       FROM vehicle_documents d
       JOIN vehicles v ON v.id = d.vehicle_id
       JOIN users u ON u.id = d.user_id
       ORDER BY d.expiry_date ASC NULLS LAST, d.created_at DESC
       LIMIT $1`,
      [Math.min(limit, 500)],
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      'SELECT * FROM vehicle_documents WHERE id = $1',
      [id],
    );
    return rows[0] || null;
  }

  async findByIdForUser(id, userId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM vehicle_documents WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return rows[0] || null;
  }

  async create(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO vehicle_documents (
        vehicle_id, user_id, doc_type, title, expiry_date, notes, file_path, original_filename
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        data.vehicle_id,
        data.user_id,
        data.doc_type || 'outro',
        data.title,
        data.expiry_date || null,
        data.notes || null,
        data.file_path || null,
        data.original_filename || null,
      ],
    );
    return rows[0];
  }

  async update(id, data) {
    const { rows } = await this.pool.query(
      `UPDATE vehicle_documents SET
        doc_type = COALESCE($2, doc_type),
        title = COALESCE($3, title),
        expiry_date = COALESCE($4, expiry_date),
        notes = COALESCE($5, notes),
        file_path = COALESCE($6, file_path),
        original_filename = COALESCE($7, original_filename),
        updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.doc_type,
        data.title,
        data.expiry_date,
        data.notes,
        data.file_path,
        data.original_filename,
      ],
    );
    return rows[0] || null;
  }

  async delete(id) {
    const { rows } = await this.pool.query(
      'DELETE FROM vehicle_documents WHERE id = $1 RETURNING *',
      [id],
    );
    return rows[0] || null;
  }

  async countExpiringWithinDays(days = 30) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vehicle_documents
       WHERE expiry_date IS NOT NULL
         AND expiry_date <= CURRENT_DATE + ($1 || ' days')::interval
         AND expiry_date >= CURRENT_DATE - interval '1 day'`,
      [String(days)],
    );
    return rows[0].count;
  }

  async listExpiringWithinDays(days = 30, { limit = 20 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT d.*, v.plate, v.brand, v.model, u.name AS user_name, u.email AS user_email
       FROM vehicle_documents d
       JOIN vehicles v ON v.id = d.vehicle_id
       JOIN users u ON u.id = d.user_id
       WHERE d.expiry_date IS NOT NULL
         AND d.expiry_date <= CURRENT_DATE + ($1 || ' days')::interval
       ORDER BY d.expiry_date ASC
       LIMIT $2`,
      [String(days), limit],
    );
    return rows;
  }

  async listNeedingReminderForUser(userId, warningDays = 30) {
    const { rows } = await this.pool.query(
      `SELECT d.*, v.plate, v.brand, v.model
       FROM vehicle_documents d
       JOIN vehicles v ON v.id = d.vehicle_id
       WHERE d.user_id = $1
         AND d.expiry_date IS NOT NULL
         AND d.expiry_date <= CURRENT_DATE + ($2 || ' days')::interval
       ORDER BY d.expiry_date ASC`,
      [userId, String(warningDays)],
    );
    return rows;
  }

  async listUserIdsNeedingReminder(warningDays = 30) {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT d.user_id
       FROM vehicle_documents d
       JOIN users u ON u.id = d.user_id
       WHERE d.expiry_date IS NOT NULL
         AND d.expiry_date <= CURRENT_DATE + ($1 || ' days')::interval
         AND u.active = true`,
      [String(warningDays)],
    );
    return rows.map((row) => row.user_id);
  }
}

let instance = null;

function getVehicleDocumentRepository() {
  if (!instance) instance = new VehicleDocumentRepository();
  return instance;
}

module.exports = { VehicleDocumentRepository, getVehicleDocumentRepository };
