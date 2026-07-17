const { getPool } = require('../db/pool');
const { isMultiTenantEnabled, DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const { tenantWhereClause, assertResourceTenant } = require('../lib/tenant/tenant-query');

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
      `SELECT id, user_id, tracking_provider, tracker_device_id, tracker_name, plate, brand, model, color, year, status,
              tracker_phone, tracker_model, tracker_model_id, tracker_imei, tracker_synced_at, created_at, updated_at
       FROM vehicles WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  }

  async findById(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = 'SELECT * FROM vehicles WHERE id = $1';
    if (isMultiTenantEnabled()) {
      const filter = tenantWhereClause(tenantId, { paramIndex: 2 });
      sql += filter.clause;
      params.push(...filter.params);
    }
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async findByIdForAdmin(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let tenantFilter = '';
    if (isMultiTenantEnabled()) {
      const filter = tenantWhereClause(tenantId, { paramIndex: 2, tableAlias: 'v' });
      tenantFilter = filter.clause;
      params.push(...filter.params);
    }
    const { rows } = await this.pool.query(
      `SELECT v.*, u.email AS user_email, u.name AS user_name,
              inst.name AS assigned_installer_name, inst.email AS assigned_installer_email
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       LEFT JOIN users inst ON inst.id = v.assigned_installer_id
       WHERE v.id = $1${tenantFilter}`,
      params,
    );
    return rows[0] || null;
  }

  async findByIdForUser(id, userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [id, userId];
    let sql = 'SELECT * FROM vehicles WHERE id = $1 AND user_id = $2';
    if (isMultiTenantEnabled()) {
      const filter = tenantWhereClause(tenantId, { paramIndex: 3 });
      sql += filter.clause;
      params.push(...filter.params);
    }
    const { rows } = await this.pool.query(sql, params);
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
    const tenantId = data.tenant_id ?? DEFAULT_TENANT_ID;
    const { rows } = await this.pool.query(
      `INSERT INTO vehicles (
        user_id, tenant_id, tracking_provider, tracker_device_id, tracker_name, plate, brand, model, color, year, status,
        tracker_phone, tracker_model, tracker_model_id, tracker_imei, tracker_synced_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        data.user_id, tenantId, data.tracking_provider || null, data.tracker_device_id, data.tracker_name,
        data.plate, data.brand, data.model, data.color, data.year,
        data.status || VEHICLE_STATUS.PENDING_INSTALLATION,
        data.tracker_phone || null,
        data.tracker_model || null,
        data.tracker_model_id || null,
        data.tracker_imei || null,
        data.tracker_synced_at || null,
      ]
    );
    return rows[0];
  }

  async update(id, data, tenantId = DEFAULT_TENANT_ID) {
    const current = await this.findById(id, tenantId);
    if (!current) throw new Error('Veículo não encontrado.');
    if (isMultiTenantEnabled() && !assertResourceTenant(current, tenantId)) {
      throw new Error('Veículo não pertence ao tenant autenticado.');
    }

    const { rows } = await this.pool.query(
      `UPDATE vehicles SET
        tracking_provider = COALESCE($2, tracking_provider),
        tracker_device_id = COALESCE($3, tracker_device_id),
        tracker_name = COALESCE($4, tracker_name),
        plate = COALESCE($5, plate),
        brand = COALESCE($6, brand),
        model = COALESCE($7, model),
        color = COALESCE($8, color),
        year = COALESCE($9, year),
        status = COALESCE($10, status),
        tracker_phone = COALESCE($11, tracker_phone),
        tracker_model = COALESCE($12, tracker_model),
        tracker_model_id = COALESCE($13, tracker_model_id),
        tracker_imei = COALESCE($14, tracker_imei),
        tracker_synced_at = COALESCE($15, tracker_synced_at),
        assigned_installer_id = CASE WHEN $16 = '__skip__' THEN assigned_installer_id ELSE $16 END,
        installation_scheduled_at = CASE WHEN $17 = '__skip__' THEN installation_scheduled_at ELSE $17 END,
        assigned_at = CASE WHEN $18 = '__skip__' THEN assigned_at ELSE $18 END,
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id, data.tracking_provider, data.tracker_device_id, data.tracker_name, data.plate,
        data.brand, data.model, data.color, data.year, data.status,
        data.tracker_phone, data.tracker_model, data.tracker_model_id, data.tracker_imei, data.tracker_synced_at,
        Object.prototype.hasOwnProperty.call(data, 'assigned_installer_id') ? data.assigned_installer_id : '__skip__',
        Object.prototype.hasOwnProperty.call(data, 'installation_scheduled_at') ? data.installation_scheduled_at : '__skip__',
        Object.prototype.hasOwnProperty.call(data, 'assigned_at') ? data.assigned_at : '__skip__',
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

  _buildAdminListQuery(filters = {}, tenantId = DEFAULT_TENANT_ID) {
    const params = [];
    const conditions = [];
    let idx = 1;

    if (isMultiTenantEnabled()) {
      conditions.push(`v.tenant_id = $${idx++}`);
      params.push(tenantId);
    }

    if (filters.q?.trim()) {
      conditions.push(`(
        v.plate ILIKE $${idx}
        OR v.brand ILIKE $${idx}
        OR v.model ILIKE $${idx}
        OR v.tracker_device_id ILIKE $${idx}
        OR v.tracker_name ILIKE $${idx}
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
      conditions.push(`(v.tracker_device_id IS NULL OR TRIM(v.tracker_device_id) = '')`);
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

  async listForAdmin(filters = {}, tenantId = DEFAULT_TENANT_ID) {
    const { where, params } = this._buildAdminListQuery(filters, tenantId);
    const orderBy = this._resolveAdminSort(filters.sort);
    const { rows } = await this.pool.query(
      `SELECT v.*, u.email AS user_email, u.name AS user_name,
              inst.name AS assigned_installer_name, inst.email AS assigned_installer_email
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       LEFT JOIN users inst ON inst.id = v.assigned_installer_id
       ${where}
       ORDER BY ${orderBy}`,
      params,
    );
    return rows;
  }

  async countForAdmin(filters = {}, tenantId = DEFAULT_TENANT_ID) {
    const { where, params } = this._buildAdminListQuery(filters, tenantId);
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       ${where}`,
      params,
    );
    return rows[0]?.count || 0;
  }

  async listPendingInstallations(installerId = null) {
    const params = [];
    let installerFilter = '';
    if (installerId) {
      params.push(installerId);
      installerFilter = `AND (v.assigned_installer_id IS NULL OR v.assigned_installer_id = $1)`;
    }

    const { rows } = await this.pool.query(
      `SELECT v.*, u.email AS user_email, u.name AS user_name, u.phone AS user_phone,
              inst.name AS assigned_installer_name, inst.email AS assigned_installer_email
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       LEFT JOIN users inst ON inst.id = v.assigned_installer_id
       WHERE v.status = 'pending_installation'
       ${installerFilter}
       ORDER BY v.installation_scheduled_at ASC NULLS LAST, v.created_at ASC`,
      params,
    );
    return rows;
  }

  async countPendingForInstaller(installerId) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vehicles
       WHERE status = 'pending_installation'
         AND (assigned_installer_id IS NULL OR assigned_installer_id = $1)`,
      [installerId],
    );
    return rows[0].count;
  }

  async assignInstaller(vehicleId, { installerId, scheduledAt }) {
    const { rows } = await this.pool.query(
      `UPDATE vehicles SET
        assigned_installer_id = $2,
        installation_scheduled_at = $3,
        assigned_at = NOW(),
        updated_at = NOW()
       WHERE id = $1 AND status = 'pending_installation'
       RETURNING *`,
      [vehicleId, installerId, scheduledAt || null],
    );
    if (!rows[0]) {
      throw new Error('Veículo não encontrado ou não está aguardando instalação.');
    }
    return rows[0];
  }

  async clearInstallerAssignment(vehicleId) {
    const { rows } = await this.pool.query(
      `UPDATE vehicles SET
        assigned_installer_id = NULL,
        installation_scheduled_at = NULL,
        assigned_at = NULL,
        updated_at = NOW()
       WHERE id = $1 AND status = 'pending_installation'
       RETURNING *`,
      [vehicleId],
    );
    if (!rows[0]) {
      throw new Error('Veículo não encontrado ou não está aguardando instalação.');
    }
    return rows[0];
  }

  async countByStatus(status) {
    const { rows } = await this.pool.query(
      'SELECT COUNT(*)::int AS count FROM vehicles WHERE status = $1',
      [status]
    );
    return rows[0].count;
  }

  async findByDeviceId(deviceId, provider = null) {
    if (!deviceId) return null;
    const params = [String(deviceId)];
    let providerFilter = '';
    if (provider) {
      params.push(normalizeProviderName(provider));
      providerFilter = `AND v.tracking_provider = $${params.length}`;
    }
    const { rows } = await this.pool.query(
      `SELECT v.*, u.email AS user_email, u.name AS user_name, u.phone AS user_phone
       FROM vehicles v
       JOIN users u ON u.id = v.user_id
       WHERE (v.tracker_device_id = $1 OR v.tracker_name = $1)
       ${providerFilter}
       LIMIT 1`,
      params
    );
    return rows[0] || null;
  }
}

function normalizeProviderName(value) {
  return String(value || 'gpswox').toLowerCase() === 'traccar' ? 'traccar' : 'gpswox';
}

let instance = null;

function getVehicleRepository() {
  if (!instance) instance = new VehicleRepository();
  return instance;
}

module.exports = { VehicleRepository, getVehicleRepository, VEHICLE_STATUS };
