const { getPool } = require('../db/pool');

class LoginAttemptRepository {
  constructor() {
    this.pool = getPool();
  }

  async record({ email, userId, ipAddress, userAgent, success, reason, sessionType = 'client' }) {
    await this.pool.query(
      `INSERT INTO login_attempts (email, user_id, ip_address, user_agent, success, reason, session_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [email || null, userId || null, ipAddress || null, userAgent || null, success, reason || null, sessionType],
    );
  }

  async countRecentFailures({ email, ipAddress, minutes = 15 }) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count
       FROM login_attempts
       WHERE success = false
         AND created_at >= NOW() - ($3 || ' minutes')::interval
         AND (($1::text IS NOT NULL AND email = $1) OR ($2::text IS NOT NULL AND ip_address = $2))`,
      [email || null, ipAddress || null, String(minutes)],
    );
    return rows[0].count;
  }

  async listRecent({ limit = 50, sessionType } = {}) {
    const params = [Math.min(limit, 100)];
    let sql = `SELECT id, email, user_id, ip_address, success, reason, session_type, created_at
               FROM login_attempts`;
    if (sessionType) {
      sql += ' WHERE session_type = $2';
      params.push(sessionType);
    }
    sql += ' ORDER BY created_at DESC LIMIT $1';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }
}

let instance = null;

function getLoginAttemptRepository() {
  if (!instance) instance = new LoginAttemptRepository();
  return instance;
}

module.exports = { LoginAttemptRepository, getLoginAttemptRepository };
