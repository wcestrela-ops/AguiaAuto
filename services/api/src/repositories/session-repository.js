const crypto = require('crypto');
const { getPool } = require('../db/pool');
const { buildSessionLabel } = require('../lib/security/device-parser');

class SessionRepository {
  constructor() {
    this.pool = getPool();
  }

  async createSession({
    userId,
    tokenHash,
    expiresAt,
    sessionType = 'client',
    userAgent,
    ipAddress,
    requestId,
  }) {
    await this.pool.query(
      `INSERT INTO refresh_tokens
        (user_id, token_hash, expires_at, session_type, user_agent, ip_address, device_label, last_seen_at, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
      [
        userId,
        tokenHash,
        expiresAt,
        sessionType,
        userAgent || null,
        ipAddress || null,
        buildSessionLabel(userAgent),
        requestId || null,
      ],
    );
  }

  async findSession(tokenHash) {
    const { rows } = await this.pool.query(
      `SELECT rt.*, u.email, u.role, u.active, u.tenant_id
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.revoked = false AND rt.expires_at > NOW()`,
      [tokenHash],
    );
    return rows[0] || null;
  }

  async touchSession(tokenHash) {
    await this.pool.query(
      `UPDATE refresh_tokens SET last_seen_at = NOW() WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  async revokeSession(tokenHash) {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  async revokeAllExcept(userId, tokenHash, sessionType) {
    await this.pool.query(
      `UPDATE refresh_tokens
       SET revoked = true
       WHERE user_id = $1
         AND session_type = $3
         AND revoked = false
         AND token_hash <> $2`,
      [userId, tokenHash, sessionType],
    );
  }

  async revokeAllForUser(userId, sessionType) {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked = true
       WHERE user_id = $1 AND session_type = $2 AND revoked = false`,
      [userId, sessionType],
    );
  }

  async listActiveSessions(userId, sessionType) {
    const { rows } = await this.pool.query(
      `SELECT id, device_label, user_agent, ip_address, created_at, last_seen_at, expires_at, request_id
       FROM refresh_tokens
       WHERE user_id = $1 AND session_type = $2 AND revoked = false AND expires_at > NOW()
       ORDER BY last_seen_at DESC NULLS LAST, created_at DESC`,
      [userId, sessionType],
    );
    return rows;
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

let instance = null;

function getSessionRepository() {
  if (!instance) instance = new SessionRepository();
  return instance;
}

module.exports = { SessionRepository, getSessionRepository };
