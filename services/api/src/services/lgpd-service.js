const { getPool } = require('../db/pool');
const { getAuditService } = require('./audit-service');
const { maskValue } = require('../infrastructure/sanitize-log');

class LgpdService {
  constructor() {
    this.pool = getPool();
  }

  async recordConsent(userId, { consentType, version, legalBasis, ipAddress, userAgent }) {
    await this.pool.query(
      `INSERT INTO lgpd_consents (user_id, consent_type, version, legal_basis, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, consentType, version, legalBasis || 'contract', ipAddress || null, userAgent || null],
    );
  }

  async exportUserData(userId) {
    const [user, vehicles, invoices, consents] = await Promise.all([
      this.pool.query(
        `SELECT id, email, name, phone, cpf_cnpj, role, created_at, last_access_at
         FROM users WHERE id = $1`,
        [userId],
      ),
      this.pool.query(
        `SELECT id, plate, brand, model, status, created_at FROM vehicles WHERE user_id = $1`,
        [userId],
      ),
      this.pool.query(
        `SELECT id, description, amount, status, due_date, created_at FROM invoices WHERE user_id = $1`,
        [userId],
      ),
      this.pool.query(
        `SELECT consent_type, version, legal_basis, accepted, created_at FROM lgpd_consents WHERE user_id = $1`,
        [userId],
      ),
    ]);

    const row = user.rows[0];
    if (!row) throw new Error('Usuário não encontrado.');

    return {
      exported_at: new Date().toISOString(),
      user: {
        ...row,
        cpf_cnpj: row.cpf_cnpj ? maskValue('cpf', row.cpf_cnpj) : null,
        phone: row.phone ? maskValue('phone', row.phone) : null,
      },
      vehicles: vehicles.rows,
      invoices: invoices.rows,
      consents: consents.rows,
    };
  }

  async requestDeletion(userId, { reason, ipAddress, userAgent }) {
    await getAuditService().log({
      actor_type: 'user',
      actor_id: String(userId),
      action: 'lgpd.deletion.requested',
      metadata: { reason: reason || null },
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      severity: 'warning',
    });

    return {
      status: 'pending_review',
      message: 'Solicitação registrada. Nossa equipe analisará conforme política de retenção legal.',
    };
  }

  async anonymizeUser(userId, { adminId, req }) {
    const { rows } = await this.pool.query('SELECT id, role FROM users WHERE id = $1', [userId]);
    const user = rows[0];
    if (!user) throw new Error('Usuário não encontrado.');
    if (['superadmin', 'admin'].includes(user.role)) {
      throw new Error('Não é permitido anonimizar contas administrativas.');
    }

    const anonEmail = `anonimizado+${userId}@invalid.local`;
    await this.pool.query(
      `UPDATE users
       SET email = $2,
           name = 'Usuário Anonimizado',
           phone = NULL,
           cpf_cnpj = NULL,
           active = false,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, anonEmail],
    );

    await this.pool.query(
      `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`,
      [userId],
    );

    await getAuditService().adminAction('lgpd.user.anonymized', {
      resourceType: 'user',
      resourceId: userId,
      req,
      metadata: { admin_id: adminId },
      severity: 'warning',
    });

    return { anonymized: true, user_id: userId };
  }

  async listRecentConsents(limit = 50) {
    const { rows } = await this.pool.query(
      `SELECT c.*, u.email AS user_email
       FROM lgpd_consents c
       JOIN users u ON u.id = c.user_id
       ORDER BY c.created_at DESC
       LIMIT $1`,
      [Math.min(limit, 100)],
    );
    return rows;
  }
}

let instance = null;

function getLgpdService() {
  if (!instance) instance = new LgpdService();
  return instance;
}

module.exports = { LgpdService, getLgpdService };
