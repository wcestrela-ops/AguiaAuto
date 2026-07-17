const { getPool } = require('../db/pool');
const { isAdminRole } = require('../lib/security/permissions');

class AdminUserRepository {
  constructor() {
    this.pool = getPool();
  }

  async findByEmail(email) {
    const { rows } = await this.pool.query(
      `SELECT * FROM users WHERE email = $1 AND role = ANY($2::varchar[])`,
      [email.toLowerCase().trim(), ['superadmin', 'admin', 'operator', 'support', 'financeiro', 'supervisor']],
    );
    return rows[0] || null;
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, role, active, tenant_id, failed_login_attempts, locked_until,
              last_login_at, password_changed_at, must_reset_password, two_factor_enabled,
              created_at, updated_at
       FROM users WHERE id = $1 AND role = ANY($2::varchar[])`,
      [id, ['superadmin', 'admin', 'operator', 'support', 'financeiro', 'supervisor']],
    );
    return rows[0] || null;
  }

  async findByIdWithSecrets(id) {
    const { rows } = await this.pool.query(
      `SELECT * FROM users WHERE id = $1 AND role = ANY($2::varchar[])`,
      [id, ['superadmin', 'admin', 'operator', 'support', 'financeiro', 'supervisor']],
    );
    return rows[0] || null;
  }

  async listAdmins() {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, role, active, last_login_at, two_factor_enabled, created_at
       FROM users
       WHERE role = ANY($1::varchar[])
       ORDER BY created_at DESC`,
      [['superadmin', 'admin', 'operator', 'support', 'financeiro', 'supervisor']],
    );
    return rows;
  }

  async countAdmins() {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM users WHERE role = ANY($1::varchar[])`,
      [['superadmin', 'admin', 'operator', 'support', 'financeiro', 'supervisor']],
    );
    return rows[0].count;
  }

  async recordFailedLogin(userId) {
    const maxAttempts = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10);
    const lockMinutes = parseInt(process.env.LOGIN_LOCK_TIME || '15', 10);

    const { rows } = await this.pool.query(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE
             WHEN failed_login_attempts + 1 >= $2 THEN NOW() + ($3 || ' minutes')::interval
             ELSE locked_until
           END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING failed_login_attempts, locked_until`,
      [userId, maxAttempts, String(lockMinutes)],
    );
    return rows[0];
  }

  async resetFailedLogin(userId) {
    await this.pool.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           last_login_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [userId],
    );
  }

  async isLocked(user) {
    if (!user?.locked_until) return false;
    return new Date(user.locked_until).getTime() > Date.now();
  }

  async setTwoFactorSecret(userId, encryptedSecret, enabled = false) {
    await this.pool.query(
      `UPDATE users
       SET two_factor_secret_encrypted = $2,
           two_factor_enabled = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, encryptedSecret, enabled],
    );
  }

  async setTransactionPinHash(userId, pinHash) {
    await this.pool.query(
      `UPDATE users SET transaction_pin_hash = $2, updated_at = NOW() WHERE id = $1`,
      [userId, pinHash],
    );
  }

  isAdminRole(role) {
    return isAdminRole(role);
  }
}

let instance = null;

function getAdminUserRepository() {
  if (!instance) instance = new AdminUserRepository();
  return instance;
}

module.exports = { AdminUserRepository, getAdminUserRepository };
