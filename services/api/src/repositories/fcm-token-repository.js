const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const { sqlAndTenant, tenantIdForInsert } = require('../lib/tenant/repository-tenant');

class FcmTokenRepository {
  constructor() {
    this.pool = getPool();
  }

  async register({ userId, token, device_name, platform = 'web', tenant_id }, tenantId = DEFAULT_TENANT_ID) {
    const tid = tenantIdForInsert({ tenant_id }, tenantId);
    const { rows } = await this.pool.query(
      `INSERT INTO fcm_tokens (tenant_id, user_id, token, device_name, platform, active, last_used_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       ON CONFLICT (user_id, token)
       DO UPDATE SET tenant_id = $1, device_name = $4, platform = $5, active = true, last_used_at = NOW()
       RETURNING id, user_id, token, device_name, platform, active, last_used_at, created_at`,
      [tid, userId, token, device_name, platform]
    );
    return rows[0];
  }

  async unregister(userId, token, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId, token];
    let sql = 'UPDATE fcm_tokens SET active = false WHERE user_id = $1 AND token = $2';
    const tenant = sqlAndTenant(tenantId, 3);
    sql += tenant.clause;
    params.push(...tenant.params);
    await this.pool.query(sql, params);
  }

  async listByUser(userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId];
    let sql = `SELECT id, token, device_name, platform, active, last_used_at, created_at
       FROM fcm_tokens WHERE user_id = $1 AND active = true`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    sql += ' ORDER BY last_used_at DESC';
    const { rows } = await this.pool.query(sql, params);
    return rows.map(row => ({
      ...row,
      token: `${row.token.slice(0, 8)}...${row.token.slice(-6)}`,
    }));
  }

  async getActiveTokens(userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [userId];
    let sql = 'SELECT token FROM fcm_tokens WHERE user_id = $1 AND active = true';
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    const { rows } = await this.pool.query(sql, params);
    return rows.map(r => r.token);
  }

  async deactivateToken(token) {
    await this.pool.query(
      'UPDATE fcm_tokens SET active = false WHERE token = $1',
      [token]
    );
  }
}

let instance = null;

function getFcmTokenRepository() {
  if (!instance) instance = new FcmTokenRepository();
  return instance;
}

module.exports = { FcmTokenRepository, getFcmTokenRepository };
