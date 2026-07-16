const { getPool } = require('../db/pool');

class VehicleMaintenanceRepository {
  constructor() {
    this.pool = getPool();
  }

  async listByUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT m.*, v.plate, v.brand, v.model
       FROM vehicle_maintenance_records m
       JOIN vehicles v ON v.id = m.vehicle_id
       WHERE m.user_id = $1
       ORDER BY m.performed_at DESC, m.created_at DESC`,
      [userId],
    );
    return rows;
  }

  async listByVehicle(vehicleId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM vehicle_maintenance_records
       WHERE vehicle_id = $1
       ORDER BY performed_at DESC, created_at DESC`,
      [vehicleId],
    );
    return rows;
  }

  async listAll({ limit = 200 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT m.*, v.plate, v.brand, v.model, u.name AS user_name, u.email AS user_email
       FROM vehicle_maintenance_records m
       JOIN vehicles v ON v.id = m.vehicle_id
       JOIN users u ON u.id = m.user_id
       ORDER BY m.next_due_date ASC NULLS LAST, m.performed_at DESC
       LIMIT $1`,
      [Math.min(limit, 500)],
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      'SELECT * FROM vehicle_maintenance_records WHERE id = $1',
      [id],
    );
    return rows[0] || null;
  }

  async findByIdForUser(id, userId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM vehicle_maintenance_records WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return rows[0] || null;
  }

  async create(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO vehicle_maintenance_records (
        vehicle_id, user_id, service_type, title, performed_at,
        odometer_km, cost, next_due_date, next_due_km, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        data.vehicle_id,
        data.user_id,
        data.service_type || 'revisao',
        data.title,
        data.performed_at,
        data.odometer_km ?? null,
        data.cost ?? null,
        data.next_due_date || null,
        data.next_due_km ?? null,
        data.notes || null,
      ],
    );
    return rows[0];
  }

  async update(id, data) {
    const { rows } = await this.pool.query(
      `UPDATE vehicle_maintenance_records SET
        service_type = COALESCE($2, service_type),
        title = COALESCE($3, title),
        performed_at = COALESCE($4, performed_at),
        odometer_km = COALESCE($5, odometer_km),
        cost = COALESCE($6, cost),
        next_due_date = COALESCE($7, next_due_date),
        next_due_km = COALESCE($8, next_due_km),
        notes = COALESCE($9, notes),
        updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.service_type,
        data.title,
        data.performed_at,
        data.odometer_km,
        data.cost,
        data.next_due_date,
        data.next_due_km,
        data.notes,
      ],
    );
    return rows[0] || null;
  }

  async delete(id) {
    const { rows } = await this.pool.query(
      'DELETE FROM vehicle_maintenance_records WHERE id = $1 RETURNING *',
      [id],
    );
    return rows[0] || null;
  }

  async countDueWithinDays(days = 30) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vehicle_maintenance_records
       WHERE next_due_date IS NOT NULL
         AND next_due_date <= CURRENT_DATE + ($1 || ' days')::interval`,
      [String(days)],
    );
    return rows[0].count;
  }

  async listDueWithinDays(days = 30, { limit = 20 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT m.*, v.plate, v.brand, v.model, u.name AS user_name, u.email AS user_email
       FROM vehicle_maintenance_records m
       JOIN vehicles v ON v.id = m.vehicle_id
       JOIN users u ON u.id = m.user_id
       WHERE m.next_due_date IS NOT NULL
         AND m.next_due_date <= CURRENT_DATE + ($1 || ' days')::interval
       ORDER BY m.next_due_date ASC
       LIMIT $2`,
      [String(days), limit],
    );
    return rows;
  }

  async listNeedingReminderForUser(userId, warningDays = 30) {
    const { rows } = await this.pool.query(
      `SELECT m.*, v.plate, v.brand, v.model
       FROM vehicle_maintenance_records m
       JOIN vehicles v ON v.id = m.vehicle_id
       WHERE m.user_id = $1
         AND m.next_due_date IS NOT NULL
         AND m.next_due_date <= CURRENT_DATE + ($2 || ' days')::interval
       ORDER BY m.next_due_date ASC`,
      [userId, String(warningDays)],
    );
    return rows;
  }

  async listUserIdsNeedingReminder(warningDays = 30) {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT m.user_id
       FROM vehicle_maintenance_records m
       JOIN users u ON u.id = m.user_id
       WHERE m.next_due_date IS NOT NULL
         AND m.next_due_date <= CURRENT_DATE + ($1 || ' days')::interval
         AND u.active = true`,
      [String(warningDays)],
    );
    return rows.map((row) => row.user_id);
  }
}

let instance = null;

function getVehicleMaintenanceRepository() {
  if (!instance) instance = new VehicleMaintenanceRepository();
  return instance;
}

module.exports = { VehicleMaintenanceRepository, getVehicleMaintenanceRepository };
