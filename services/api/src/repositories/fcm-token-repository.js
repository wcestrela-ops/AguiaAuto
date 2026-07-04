const { getPool } = require('../db/pool');

class FcmTokenRepository {
  constructor() {
    this.pool = getPool();
  }

  async register({ userId, token, device_name, platform = 'web' }) {
    const { rows } = await this.pool.query(
      `INSERT INTO fcm_tokens (user_id, token, device_name, platform, active, last_used_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       ON CONFLICT (user_id, token)
       DO UPDATE SET device_name = $3, platform = $4, active = true, last_used_at = NOW()
       RETURNING id, user_id, token, device_name, platform, active, last_used_at, created_at`,
      [userId, token, device_name, platform]
    );
    return rows[0];
  }

  async unregister(userId, token) {
    await this.pool.query(
      'UPDATE fcm_tokens SET active = false WHERE user_id = $1 AND token = $2',
      [userId, token]
    );
  }

  async listByUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT id, token, device_name, platform, active, last_used_at, created_at
       FROM fcm_tokens WHERE user_id = $1 AND active = true ORDER BY last_used_at DESC`,
      [userId]
    );
    return rows.map(row => ({
      ...row,
      token: `${row.token.slice(0, 8)}...${row.token.slice(-6)}`,
    }));
  }

  async getActiveTokens(userId) {
    const { rows } = await this.pool.query(
      'SELECT token FROM fcm_tokens WHERE user_id = $1 AND active = true',
      [userId]
    );
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
