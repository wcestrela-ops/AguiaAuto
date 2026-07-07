const crypto = require('crypto');
const { getPool } = require('../db/pool');

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

class PasswordResetRepository {
  constructor() {
    this.pool = getPool();
  }

  async invalidateUserTokens(userId) {
    await this.pool.query(
      'UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false',
      [userId]
    );
  }

  async create(userId, code, expiresAt) {
    await this.invalidateUserTokens(userId);
    const { rows } = await this.pool.query(
      `INSERT INTO password_reset_tokens (user_id, code_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, expires_at, created_at`,
      [userId, hashCode(code), expiresAt]
    );
    return rows[0];
  }

  async findValid(userId, code) {
    const { rows } = await this.pool.query(
      `SELECT * FROM password_reset_tokens
       WHERE user_id = $1 AND code_hash = $2 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, hashCode(code)]
    );
    return rows[0] || null;
  }

  async markUsed(id) {
    await this.pool.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [id]);
  }

  async countRecentRequests(userId, minutes = 15) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM password_reset_tokens
       WHERE user_id = $1 AND created_at > NOW() - make_interval(mins => $2)`,
      [userId, minutes]
    );
    return rows[0].count;
  }
}

let instance = null;

function getPasswordResetRepository() {
  if (!instance) instance = new PasswordResetRepository();
  return instance;
}

module.exports = { PasswordResetRepository, getPasswordResetRepository, hashCode };
