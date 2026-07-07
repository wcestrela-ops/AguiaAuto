const { getPool } = require('../db/pool');

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

  async create(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO referrals (
        referrer_user_id, referred_user_id, referral_code, discount_percent, discount_status
      ) VALUES ($1,$2,$3,$4,'awaiting_completion') RETURNING *`,
      [
        data.referrer_user_id,
        data.referred_user_id,
        data.referral_code,
        data.discount_percent || 50,
      ]
    );
    return rows[0];
  }

  async findByReferredUser(referredUserId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM referrals WHERE referred_user_id = $1',
      [referredUserId]
    );
    return rows[0] || null;
  }

  async findById(id) {
    const { rows } = await this.pool.query('SELECT * FROM referrals WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async listByReferrer(referrerUserId, { limit = 50 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT r.*, u.name AS referred_name, u.email AS referred_email, u.created_at AS referred_at
       FROM referrals r
       JOIN users u ON u.id = r.referred_user_id
       WHERE r.referrer_user_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [referrerUserId, limit]
    );
    return rows;
  }

  async countByReferrer(referrerUserId) {
    const { rows } = await this.pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE discount_status IN ('qualified', 'applied'))::int AS confirmadas,
         COUNT(*) FILTER (WHERE discount_applied = true)::int AS com_desconto
       FROM referrals WHERE referrer_user_id = $1`,
      [referrerUserId]
    );
    return rows[0];
  }

  async markQualified(id) {
    const { rows } = await this.pool.query(
      `UPDATE referrals SET
        discount_status = 'qualified',
        qualified_at = COALESCE(qualified_at, NOW())
       WHERE id = $1 AND discount_status = 'awaiting_completion'
       RETURNING *`,
      [id]
    );
    return rows[0] || null;
  }

  async countQualifiedInMonth(referrerUserId, yearMonth) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM referrals
       WHERE referrer_user_id = $1
         AND qualified_at IS NOT NULL
         AND to_char(qualified_at AT TIME ZONE 'UTC', 'YYYY-MM') = $2`,
      [referrerUserId, yearMonth]
    );
    return rows[0].count;
  }

  async listQualifiedInMonth(referrerUserId, yearMonth) {
    const { rows } = await this.pool.query(
      `SELECT * FROM referrals
       WHERE referrer_user_id = $1
         AND qualified_at IS NOT NULL
         AND to_char(qualified_at AT TIME ZONE 'UTC', 'YYYY-MM') = $2
       ORDER BY qualified_at ASC`,
      [referrerUserId, yearMonth]
    );
    return rows;
  }

  async markAppliedForInvoice(ids, invoiceId) {
    if (!ids.length) return [];
    const { rows } = await this.pool.query(
      `UPDATE referrals SET
        discount_applied = true,
        discount_invoice_id = $2,
        discount_status = 'applied'
       WHERE id = ANY($1::int[])
       RETURNING *`,
      [ids, invoiceId]
    );
    return rows;
  }

  async listReferrersNeedingRewardSync() {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT referrer_user_id FROM referrals
       WHERE discount_status = 'qualified'
       ORDER BY referrer_user_id`
    );
    return rows.map((r) => r.referrer_user_id);
  }

  async listAwaitingCompletion() {
    const { rows } = await this.pool.query(
      `SELECT * FROM referrals WHERE discount_status = 'awaiting_completion'`
    );
    return rows;
  }
}

let instance = null;

function getReferralRepository() {
  if (!instance) instance = new ReferralRepository();
  return instance;
}

module.exports = { ReferralRepository, getReferralRepository };
