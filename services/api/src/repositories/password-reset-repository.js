const crypto = require('crypto');
const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const { sqlAndTenant, tenantIdForInsert } = require('../lib/tenant/repository-tenant');

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

class PasswordResetRepository {
  constructor() {
    this.pool = getPool();
  }

  async invalidateUserTokens(userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId];
    let sql = 'UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false';
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    await this.pool.query(sql, params);
  }

  async create(userId, code, expiresAt, tenantId = DEFAULT_TENANT_ID) {
    await this.invalidateUserTokens(userId, tenantId);
    const tid = tenantIdForInsert(null, tenantId);
    const { rows } = await this.pool.query(
      `INSERT INTO password_reset_tokens (tenant_id, user_id, code_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, expires_at, created_at`,
      [tid, userId, hashCode(code), expiresAt]
    );
    return rows[0];
  }

  async findValid(userId, code, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId, hashCode(code)];
    let sql = `SELECT * FROM password_reset_tokens
       WHERE user_id = $1 AND code_hash = $2 AND used = false AND expires_at > NOW()`;
    const tenant = sqlAndTenant(tenantId, 3);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY created_at DESC LIMIT 1';
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async markUsed(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = 'UPDATE password_reset_tokens SET used = true WHERE id = $1';
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    await this.pool.query(sql, params);
  }

  async countRecentRequests(userId, minutes = 15, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId, minutes];
    let sql = `SELECT COUNT(*)::int AS count FROM password_reset_tokens
       WHERE user_id = $1 AND created_at > NOW() - make_interval(mins => $2)`;
    const tenant = sqlAndTenant(tenantId, 3);
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows[0].count;
  }
}

let instance = null;

function getPasswordResetRepository() {
  if (!instance) instance = new PasswordResetRepository();
  return instance;
}

module.exports = { PasswordResetRepository, getPasswordResetRepository, hashCode };
