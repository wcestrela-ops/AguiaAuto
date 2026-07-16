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
      `SELECT id, user_id, gpswox_device_id, gpswox_name, plate, brand, model, color, year, status,
              tracker_phone, tracker_model, tracker_model_id, tracker_imei, gpswox_synced_at, created_at, updated_at
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
      `INSERT INTO vehicles (
        user_id, gpswox_device_id, gpswox_name, plate, brand, model, color, year, status,
        tracker_phone, tracker_model, tracker_model_id, tracker_imei, gpswox_synced_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        data.user_id, data.gpswox_device_id, data.gpswox_name,
        data.plate, data.brand, data.model, data.color, data.year,
        data.status || VEHICLE_STATUS.PENDING_INSTALLATION,
        data.tracker_phone || null,
        data.tracker_model || null,
        data.tracker_model_id || null,
        data.tracker_imei || null,
        data.gpswox_synced_at || null,
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
        tracker_phone = COALESCE($10, tracker_phone),
        tracker_model = COALESCE($11, tracker_model),
        tracker_model_id = COALESCE($12, tracker_model_id),
        tracker_imei = COALESCE($13, tracker_imei),
        gpswox_synced_at = COALESCE($14, gpswox_synced_at),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id, data.gpswox_device_id, data.gpswox_name, data.plate,
        data.brand, data.model, data.color, data.year, data.status,
        data.tracker_phone, data.tracker_model, data.tracker_model_id, data.tracker_imei, data.gpswox_synced_at,
      ]
    );
    return rows[0];
  }

  async findByPlate(plate) {
    if (!plate?.trim()) return null;
    const normalized = plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const { rows } = await this.pool.query(
      `SELECT * FROM vehicles
       WHERE UPPER(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g')) = $1
       LIMIT 1`,
      [normalized],
    );
    return rows[0] || null;
  }

  async listAll() {
    return this.listForAdmin({});
  }

  _buildAdminListQuery(filters = {}) {
    const params = [];
    const conditions = [];
    let idx = 1;

    if (filters.q?.trim()) {
      conditions.push(`(
        v.plate ILIKE $${idx}
        OR v.brand ILIKE $${idx}
        OR v.model ILIKE $${idx}
        OR v.gpswox_device_id ILIKE $${idx}
        OR v.gpswox_name ILIKE $${idx}
        OR v.tracker_phone ILIKE $${idx}
        OR v.tracker_imei ILIKE $${idx}
        OR u.name ILIKE $${idx}
        OR u.email ILIKE $${idx}
      )`);
      params.push(`%${filters.q.trim()}%`);
      idx += 1;
    }

    if (filters.status) {
      conditions.push(`v.status = $${idx++}`);
      params.push(filters.status);
    }

    if (filters.user_id) {
      conditions.push(`v.user_id = $${idx++}`);
      params.push(Number(filters.user_id));
    }

    if (filters.issue === 'missing_device') {
      conditions.push(`(v.gpswox_device_id IS NULL OR TRIM(v.gpswox_device_id) = '')`);
    } else if (filters.issue === 'missing_chip') {
      conditions.push(`v.status IN ('active', 'blocked')`);
      conditions.push(`(v.tracker_phone IS NULL OR TRIM(v.tracker_phone) = '')`);
    } else if (filters.issue === 'missing_imei') {
      conditions.push(`v.status IN ('active', 'blocked')`);
      conditions.push(`(v.tracker_imei IS NULL OR TRIM(v.tracker_imei) = '')`);
    } else if (filters.issue === 'missing_model') {
      conditions.push(`v.status IN ('active', 'blocked')`);
      conditions.push(`v.tracker_model_id IS NULL`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return { where, params };
  }

  _resolveAdminSort(sort) {
    const map = {
      created_desc: 'v.created_at DESC',
      created_asc: 'v.created_at ASC',
      plate_asc: 'v.plate ASC NULLS LAST, v.created_at DESC',
      client_asc: 'u.name ASC NULLS LAST, u.email ASC, v.created_at DESC',
      status_asc: 'v.status ASC, v.created_at DESC',
    };
    return map[sort] || map.created_desc;
  }

  async listForAdmin(filters = {}) {
    const { where, params } = this._buildAdminListQuery(filters);
    const orderBy = this._resolveAdminSort(filters.sort);
    const { rows } = await this.pool.query(
      `SELECT v.*, u.email AS user_email, u.name AS user_name
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       ${where}
       ORDER BY ${orderBy}`,
      params,
    );
    return rows;
  }

  async countForAdmin(filters = {}) {
    const { where, params } = this._buildAdminListQuery(filters);
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       ${where}`,
      params,
    );
    return rows[0]?.count || 0;
  }

  async listPendingInstallations() {
    const { rows } = await this.pool.query(
      `SELECT v.*, u.email AS user_email, u.name AS user_name, u.phone AS user_phone
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       WHERE v.status = 'pending_installation'
       ORDER BY v.created_at ASC`
    );
    return rows;
  }

  async countByStatus(status) {
    const { rows } = await this.pool.query(
      'SELECT COUNT(*)::int AS count FROM vehicles WHERE status = $1',
      [status]
    );
    return rows[0].count;
  }

  async findByDeviceId(deviceId) {
    if (!deviceId) return null;
    const { rows } = await this.pool.query(
      `SELECT v.*, u.email AS user_email, u.name AS user_name, u.phone AS user_phone
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       WHERE v.gpswox_device_id = $1 OR v.gpswox_name = $1
       LIMIT 1`,
      [String(deviceId)]
    );
    return rows[0] || null;
  }
}

let instance = null;

function getVehicleRepository() {
  if (!instance) instance = new VehicleRepository();
  return instance;
}

module.exports = { VehicleRepository, getVehicleRepository, VEHICLE_STATUS };
