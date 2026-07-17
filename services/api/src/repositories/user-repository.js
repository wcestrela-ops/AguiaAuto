const { hashPassword, verifyPassword: verifyPasswordHash, rehashIfNeeded } = require('../lib/security/password-hash');
const crypto = require('crypto');
const { getPool } = require('../db/pool');
const { isMultiTenantEnabled, DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const { tenantWhereClause, appendTenantFilter } = require('../lib/tenant/tenant-query');

const CLIENT_SORT_SQL = {
  created_desc: 'u.created_at DESC',
  last_access_desc: 'u.last_access_at DESC NULLS LAST',
  last_access_asc: 'u.last_access_at ASC NULLS FIRST',
  name_asc: 'u.name ASC NULLS LAST',
};

const INACTIVE_ACCESS_DAYS_DEFAULT = 30;

function resolveClientSort(sort) {
  return CLIENT_SORT_SQL[sort] || CLIENT_SORT_SQL.created_desc;
}

class UserRepository {
  constructor() {
    this.pool = getPool();
  }

  async findByEmail(email, tenantId = DEFAULT_TENANT_ID) {
    const params = [email.toLowerCase().trim()];
    let sql = 'SELECT * FROM users WHERE email = $1';
    if (isMultiTenantEnabled()) {
      const filter = tenantWhereClause(tenantId, { paramIndex: 2 });
      sql += filter.clause;
      params.push(...filter.params);
    }
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async findByCpfCnpj(cpfCnpj) {
    const digits = String(cpfCnpj || '').replace(/\D/g, '');
    if (!digits) return null;
    const { rows } = await this.pool.query(
      `SELECT id, email, name, cpf_cnpj, asaas_customer_id FROM users
       WHERE regexp_replace(COALESCE(cpf_cnpj, ''), '[^0-9]', '', 'g') = $1
       LIMIT 1`,
      [digits],
    );
    return rows[0] || null;
  }

  async findByAsaasCustomerId(asaasCustomerId) {
    if (!asaasCustomerId) return null;
    const { rows } = await this.pool.query(
      `SELECT id, email, name, phone, cpf_cnpj, role, active, asaas_customer_id,
              provisioning_status, created_at
       FROM users
       WHERE asaas_customer_id = $1
       LIMIT 1`,
      [String(asaasCustomerId)],
    );
    return rows[0] || null;
  }

  async findById(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = `SELECT id, email, name, phone, cpf_cnpj, role, active, email_verified,
              tenant_id, last_access_at, last_access_ip, created_at, updated_at
       FROM users WHERE id = $1`;
    if (isMultiTenantEnabled()) {
      const filter = tenantWhereClause(tenantId, { paramIndex: 2 });
      sql += filter.clause;
      params.push(...filter.params);
    }
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async findByTrackerUserId(trackerUserId) {
    return this.findByPlatformUserId('gpswox', trackerUserId);
  }

  async findByPlatformUserId(provider, platformUserId) {
    if (!platformUserId) return null;
    const column = provider === 'traccar' ? 'traccar_user_id' : 'gpswox_user_id';
    const { rows } = await this.pool.query(
      `SELECT id, email, name, phone, gpswox_user_id, traccar_user_id
       FROM users WHERE ${column} = $1 LIMIT 1`,
      [String(platformUserId)],
    );
    return rows[0] || null;
  }

  /** @deprecated use findByPlatformUserId */
  async findByGpswoxUserId(trackerUserId) {
    return this.findByPlatformUserId('gpswox', trackerUserId);
  }

  async findByIdWithPassword(id) {
    const { rows } = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async create({ email, password, name, phone, cpf_cnpj, role = 'client', tenant_id = DEFAULT_TENANT_ID }) {
    const passwordHash = await hashPassword(password);
    const { rows } = await this.pool.query(
      `INSERT INTO users (email, password_hash, name, phone, cpf_cnpj, role, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, name, phone, cpf_cnpj, role, tenant_id, active, email_verified, created_at`,
      [email.toLowerCase().trim(), passwordHash, name, phone, cpf_cnpj, role, tenant_id]
    );
    return rows[0];
  }

  async createImportedFromAsaas({
    email,
    name,
    phone,
    cpf_cnpj,
    asaas_customer_id,
  }) {
    const passwordHash = await hashPassword(crypto.randomBytes(16).toString('base64url'));
    const { rows } = await this.pool.query(
      `INSERT INTO users (
        email, password_hash, name, phone, cpf_cnpj, role,
        asaas_customer_id, provisioning_status
      ) VALUES ($1, $2, $3, $4, $5, 'client', $6, 'partial')
      RETURNING id, email, name, phone, cpf_cnpj, role, active,
                asaas_customer_id, provisioning_status, created_at`,
      [
        email.toLowerCase().trim(),
        passwordHash,
        name,
        phone || null,
        cpf_cnpj || null,
        asaas_customer_id,
      ],
    );
    return rows[0];
  }

  async updatePassword(userId, newPassword) {
    const passwordHash = await hashPassword(newPassword);
    await this.pool.query(
      'UPDATE users SET password_hash = $2, password_changed_at = NOW(), updated_at = NOW() WHERE id = $1',
      [userId, passwordHash]
    );
  }

  async updatePasswordHash(userId, passwordHash) {
    await this.pool.query(
      'UPDATE users SET password_hash = $2, password_changed_at = NOW(), updated_at = NOW() WHERE id = $1',
      [userId, passwordHash]
    );
  }

  async updateProfile(userId, { name, phone }) {
    const { rows } = await this.pool.query(
      `UPDATE users SET
        name = COALESCE($2, name),
        phone = COALESCE($3, phone),
        updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, name, phone, cpf_cnpj, role, active, email_verified, created_at, updated_at`,
      [userId, name, phone]
    );
    return rows[0];
  }

  async verifyPassword(user, password) {
    const result = await verifyPasswordHash(password, user.password_hash);
    return result.valid;
  }

  async verifyPasswordDetailed(user, password) {
    return verifyPasswordHash(password, user.password_hash);
  }

  async saveRefreshToken(userId, tokenHash, expiresAt) {
    await this.pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt]
    );
  }

  async findRefreshToken(tokenHash) {
    const { rows } = await this.pool.query(
      `SELECT rt.*, u.email, u.role, u.active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.revoked = false AND rt.expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] || null;
  }

  async revokeRefreshToken(tokenHash) {
    await this.pool.query(
      'UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1',
      [tokenHash]
    );
  }

  async revokeAllUserTokens(userId) {
    await this.pool.query(
      'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1',
      [userId]
    );
  }

  async listAll(tenantId = DEFAULT_TENANT_ID) {
    const params = [];
    const conditions = [];
    let idx = 1;
    idx = appendTenantFilter(conditions, params, idx, tenantId);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT id, email, name, phone, role, active, cpf_cnpj,
              asaas_customer_id, mercadopago_payer_id, tracker_user_id,
              provisioning_status, provisioning_errors,
              last_access_at, last_access_ip, created_at
       FROM users
       ${where}
       ORDER BY name NULLS LAST, email`,
      params,
    );
    return rows;
  }

  _buildClientListQuery(filters = {}) {
    const params = [];
    const conditions = ["u.role = 'client'"];
    let idx = 1;

    if (filters.q) {
      conditions.push(`(
        u.name ILIKE $${idx}
        OR u.email ILIKE $${idx}
        OR COALESCE(u.phone, '') ILIKE $${idx}
        OR COALESCE(u.cpf_cnpj, '') ILIKE $${idx}
      )`);
      params.push(`%${filters.q}%`);
      idx += 1;
    }

    if (filters.active === 'true' || filters.active === true) {
      conditions.push('u.active = true');
    } else if (filters.active === 'false' || filters.active === false) {
      conditions.push('u.active = false');
    }

    if (filters.provisioning_status) {
      conditions.push(`COALESCE(u.provisioning_status, 'pending') = $${idx++}`);
      params.push(filters.provisioning_status);
    }

    if (filters.never_accessed === 'true' || filters.never_accessed === true) {
      conditions.push('u.last_access_at IS NULL');
      conditions.push('u.active = true');
    } else     if (filters.access_inactive_days) {
      const days = Math.max(parseInt(filters.access_inactive_days, 10), 1);
      conditions.push(`(
        u.last_access_at IS NULL
        OR u.last_access_at < NOW() - ($${idx} || ' days')::interval
      )`);
      params.push(String(days));
      idx += 1;
      conditions.push('u.active = true');
    }

    if (isMultiTenantEnabled()) {
      idx = appendTenantFilter(conditions, params, idx, filters.tenantId ?? DEFAULT_TENANT_ID, { alias: 'u' });
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return { where, params, nextIdx: idx };
  }

  async listClients(filters = {}) {
    const limit = Math.min(Math.max(parseInt(filters.limit || '50', 10), 1), 200);
    const offset = Math.max(parseInt(filters.offset || '0', 10), 0);
    const { where, params, nextIdx } = this._buildClientListQuery(filters);
    const orderBy = resolveClientSort(filters.sort);

    params.push(limit, offset);
    const { rows } = await this.pool.query(
      `SELECT
         u.id, u.email, u.name, u.phone, u.cpf_cnpj, u.role, u.active,
         u.asaas_customer_id, u.mercadopago_payer_id, u.tracker_user_id,
         u.provisioning_status, u.provisioning_errors, u.referral_code,
         u.last_access_at, u.last_access_ip, u.created_at,
         COUNT(DISTINCT v.id)::int AS vehicles_count,
         COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'active')::int AS vehicles_active,
         COUNT(DISTINCT i.id) FILTER (WHERE i.status IN ('pending', 'overdue'))::int AS open_invoices
       FROM users u
       LEFT JOIN vehicles v ON v.user_id = u.id
       LEFT JOIN invoices i ON i.user_id = u.id
       ${where}
       GROUP BY u.id
       ORDER BY ${orderBy}
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      params,
    );
    return rows;
  }

  async countClients(filters = {}) {
    const { where, params } = this._buildClientListQuery(filters);
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM users u ${where}`,
      params,
    );
    return rows[0]?.count || 0;
  }

  async getClientPanelStats(days = INACTIVE_ACCESS_DAYS_DEFAULT) {
    const inactiveDays = String(Math.max(parseInt(days, 10), 1));
    const { rows } = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE role = 'client')::int AS total,
         COUNT(*) FILTER (WHERE role = 'client' AND active = true)::int AS active,
         COUNT(*) FILTER (WHERE role = 'client' AND active = false)::int AS inactive,
         COUNT(*) FILTER (
           WHERE role = 'client'
             AND COALESCE(provisioning_status, 'pending') NOT IN ('completed')
         )::int AS provisioning_pending,
         COUNT(*) FILTER (
           WHERE role = 'client'
             AND id IN (
               SELECT DISTINCT user_id FROM invoices WHERE status IN ('pending', 'overdue')
             )
         )::int AS with_open_invoices,
         COUNT(*) FILTER (
           WHERE role = 'client'
             AND active = true
             AND last_access_at IS NULL
         )::int AS never_accessed,
         COUNT(*) FILTER (
           WHERE role = 'client'
             AND active = true
             AND (
               last_access_at IS NULL
               OR last_access_at < NOW() - ($1 || ' days')::interval
             )
         )::int AS inactive_access
       FROM users`,
      [inactiveDays],
    );
    return {
      ...rows[0],
      inactive_access_days: Number(inactiveDays),
    };
  }

  async listInactiveAccessClients(days = INACTIVE_ACCESS_DAYS_DEFAULT, limit = 15) {
    const inactiveDays = String(Math.max(parseInt(days, 10), 1));
    const { rows } = await this.pool.query(
      `SELECT id, email, name, phone, last_access_at, last_access_ip, created_at
       FROM users
       WHERE role = 'client'
         AND active = true
         AND (
           last_access_at IS NULL
           OR last_access_at < NOW() - ($1 || ' days')::interval
         )
       ORDER BY last_access_at ASC NULLS FIRST, created_at DESC
       LIMIT $2`,
      [inactiveDays, Math.min(limit, 50)],
    );
    return rows;
  }

  async countInactiveAccessClients(days = INACTIVE_ACCESS_DAYS_DEFAULT) {
    const inactiveDays = String(Math.max(parseInt(days, 10), 1));
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE role = 'client'
         AND active = true
         AND (
           last_access_at IS NULL
           OR last_access_at < NOW() - ($1 || ' days')::interval
         )`,
      [inactiveDays],
    );
    return rows[0]?.count || 0;
  }

  async updateAdminProfile(userId, { name, phone, active }) {
    const { rows } = await this.pool.query(
      `UPDATE users SET
        name = COALESCE($2, name),
        phone = COALESCE($3, phone),
        active = COALESCE($4, active),
        updated_at = NOW()
       WHERE id = $1 AND role = 'client'
       RETURNING id, email, name, phone, cpf_cnpj, role, active,
                 asaas_customer_id, mercadopago_payer_id, tracker_user_id,
                 provisioning_status, provisioning_errors, referral_code,
                 created_at, updated_at`,
      [userId, name, phone, active],
    );
    return rows[0] || null;
  }

  async updateProvisioning(userId, data) {
    const { rows } = await this.pool.query(
      `UPDATE users SET
        asaas_customer_id = COALESCE($2, asaas_customer_id),
        mercadopago_payer_id = COALESCE($3, mercadopago_payer_id),
        gpswox_user_id = COALESCE($4, gpswox_user_id),
        traccar_user_id = COALESCE($5, traccar_user_id),
        provisioning_status = COALESCE($6, provisioning_status),
        provisioning_errors = COALESCE($7, provisioning_errors),
        updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, name, phone, cpf_cnpj, role, active,
                 asaas_customer_id, mercadopago_payer_id,
                 gpswox_user_id, traccar_user_id, tracker_user_id,
                 provisioning_status, provisioning_errors, created_at, updated_at`,
      [
        userId,
        data.asaas_customer_id,
        data.mercadopago_payer_id,
        data.gpswox_user_id,
        data.traccar_user_id,
        data.provisioning_status,
        data.provisioning_errors ? JSON.stringify(data.provisioning_errors) : null,
      ]
    );
    return rows[0] || null;
  }

  async findByIdWithProvisioning(id) {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, phone, cpf_cnpj, role, active,
              asaas_customer_id, mercadopago_payer_id,
              gpswox_user_id, traccar_user_id, tracker_user_id,
              provisioning_status, provisioning_errors,
              last_access_at, last_access_ip, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async recordClientAccess(userId, { ip, force = false } = {}) {
    if (!userId) return null;

    const sets = ['last_access_at = NOW()', 'updated_at = NOW()'];
    const params = [userId];
    if (ip) {
      params.push(ip);
      sets.push(`last_access_ip = $${params.length}`);
    }

    const throttle = force
      ? ''
      : `AND (last_access_at IS NULL OR last_access_at < NOW() - INTERVAL '15 minutes')`;

    const { rows } = await this.pool.query(
      `UPDATE users SET ${sets.join(', ')}
       WHERE id = $1 AND role = 'client' ${throttle}
       RETURNING id, last_access_at, last_access_ip`,
      params,
    );
    return rows[0] || null;
  }
}

let instance = null;

function getUserRepository() {
  if (!instance) instance = new UserRepository();
  return instance;
}

module.exports = { UserRepository, getUserRepository, INACTIVE_ACCESS_DAYS_DEFAULT };
