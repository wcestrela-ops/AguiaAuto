const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const {
  sqlAndTenant,
  appendTenantConditions,
  tenantIdForInsert,
} = require('../lib/tenant/repository-tenant');

class ReferralRepository {
  constructor() {
    this.pool = getPool();
  }

  async findByCode(code) {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, referral_code FROM users
       WHERE UPPER(referral_code) = UPPER($1) AND active = true`,
      [String(code || '').trim()]
    );
    return rows[0] || null;
  }

  async getReferralCode(userId) {
    const { rows } = await this.pool.query(
      'SELECT referral_code FROM users WHERE id = $1',
      [userId]
    );
    return rows[0]?.referral_code || null;
  }

  async setReferralCode(userId, code) {
    const { rows } = await this.pool.query(
      `UPDATE users SET referral_code = $2, updated_at = NOW()
       WHERE id = $1 AND referral_code IS NULL
       RETURNING id, referral_code`,
      [userId, code]
    );
    return rows[0] || null;
  }

  async codeExists(code) {
    const { rows } = await this.pool.query(
      'SELECT id FROM users WHERE UPPER(referral_code) = UPPER($1) LIMIT 1',
      [code]
    );
    return Boolean(rows[0]);
  }

  async create(data, tenantId = DEFAULT_TENANT_ID) {
    const tid = tenantIdForInsert(data, tenantId);
    const { rows } = await this.pool.query(
      `INSERT INTO referrals (
        tenant_id, referrer_user_id, referred_user_id, referral_code, discount_percent, discount_status
      ) VALUES ($1,$2,$3,$4,$5,'awaiting_completion') RETURNING *`,
      [
        tid,
        data.referrer_user_id,
        data.referred_user_id,
        data.referral_code,
        data.discount_percent || 50,
      ]
    );
    return rows[0];
  }

  async findByReferredUser(referredUserId, tenantId = DEFAULT_TENANT_ID) {
    const params = [referredUserId];
    let sql = 'SELECT * FROM referrals WHERE referred_user_id = $1';
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async findById(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = 'SELECT * FROM referrals WHERE id = $1';
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async listByReferrer(referrerUserId, { limit = 50, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [referrerUserId];
    let sql = `SELECT r.*, u.name AS referred_name, u.email AS referred_email, u.created_at AS referred_at
       FROM referrals r
       JOIN users u ON u.id = r.referred_user_id
       WHERE r.referrer_user_id = $1`;
    const tenant = sqlAndTenant(tenantId, 2, { alias: 'r' });
    sql += tenant.clause;
    params.push(...tenant.params);
    const limitIdx = tenant.nextIndex;
    params.push(limit);
    sql += ` ORDER BY r.created_at DESC LIMIT $${limitIdx}`;
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async countByReferrer(referrerUserId, tenantId = DEFAULT_TENANT_ID) {
    const params = [referrerUserId];
    let sql = `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE discount_status IN ('qualified', 'applied'))::int AS confirmadas,
         COUNT(*) FILTER (WHERE discount_applied = true)::int AS com_desconto
       FROM referrals WHERE referrer_user_id = $1`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0];
  }

  async markQualified(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = `UPDATE referrals SET
        discount_status = 'qualified',
        qualified_at = COALESCE(qualified_at, NOW())
       WHERE id = $1 AND discount_status = 'awaiting_completion'`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' RETURNING *';
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async countQualifiedInMonth(referrerUserId, yearMonth, tenantId = DEFAULT_TENANT_ID) {
    const params = [referrerUserId, yearMonth];
    let sql = `SELECT COUNT(*)::int AS count FROM referrals
       WHERE referrer_user_id = $1
         AND qualified_at IS NOT NULL
         AND to_char(qualified_at AT TIME ZONE 'UTC', 'YYYY-MM') = $2`;
    const tenant = sqlAndTenant(tenantId, 3);
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0].count;
  }

  async listQualifiedInMonth(referrerUserId, yearMonth, tenantId = DEFAULT_TENANT_ID) {
    const params = [referrerUserId, yearMonth];
    let sql = `SELECT * FROM referrals
       WHERE referrer_user_id = $1
         AND qualified_at IS NOT NULL
         AND to_char(qualified_at AT TIME ZONE 'UTC', 'YYYY-MM') = $2`;
    const tenant = sqlAndTenant(tenantId, 3);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY qualified_at ASC';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async markAppliedForInvoice(ids, invoiceId, tenantId = DEFAULT_TENANT_ID) {
    if (!ids.length) return [];
    const params = [ids, invoiceId];
    let sql = `UPDATE referrals SET
        discount_applied = true,
        discount_invoice_id = $2,
        discount_status = 'applied'
       WHERE id = ANY($1::int[])`;
    const tenant = sqlAndTenant(tenantId, 3);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' RETURNING *';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listReferrersNeedingRewardSync() {
    const params = [];
    const conditions = ["discount_status = 'qualified'"];
    appendTenantConditions(conditions, params, 1, null, { allTenants: true });
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT DISTINCT referrer_user_id FROM referrals
       ${where}
       ORDER BY referrer_user_id`,
      params,
    );
    return rows.map((r) => r.referrer_user_id);
  }

  async listAwaitingCompletion() {
    const params = [];
    const conditions = ["discount_status = 'awaiting_completion'"];
    appendTenantConditions(conditions, params, 1, null, { allTenants: true });
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT * FROM referrals ${where}`,
      params,
    );
    return rows;
  }

  async listAll({ limit = 100, status, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [Math.min(limit, 300)];
    const conditions = [];
    let idx = 2;
    if (status) {
      conditions.push(`r.discount_status = $${idx++}`);
      params.push(status);
    }
    idx = appendTenantConditions(conditions, params, idx, tenantId, { alias: 'r' });
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT r.*,
              ref.name AS referrer_name, ref.email AS referrer_email, ref.referral_code AS referrer_code,
              u.name AS referred_name, u.email AS referred_email, u.created_at AS referred_at
       FROM referrals r
       JOIN users ref ON ref.id = r.referrer_user_id
       JOIN users u ON u.id = r.referred_user_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT $1`,
      params,
    );
    return rows;
  }

  async getGlobalStats(tenantId = DEFAULT_TENANT_ID) {
    const params = [];
    const conditions = [];
    appendTenantConditions(conditions, params, 1, tenantId);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE discount_status = 'awaiting_completion')::int AS aguardando,
         COUNT(*) FILTER (WHERE discount_status = 'qualified')::int AS qualificadas,
         COUNT(*) FILTER (WHERE discount_status = 'applied')::int AS desconto_aplicado,
         COUNT(DISTINCT referrer_user_id)::int AS indicadores_ativos
       FROM referrals
       ${where}`,
      params,
    );
    return rows[0];
  }
}

let instance = null;

function getReferralRepository() {
  if (!instance) instance = new ReferralRepository();
  return instance;
}

module.exports = { ReferralRepository, getReferralRepository };
