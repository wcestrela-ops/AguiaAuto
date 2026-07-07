const { getPool } = require('../db/pool');

class InvoiceRepository {
  constructor() {
    this.pool = getPool();
  }

  async listByUser(userId, { limit = 50 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT * FROM invoices WHERE user_id = $1
       ORDER BY due_date DESC NULLS LAST, created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return rows;
  }

  async listAll({ limit = 100 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT i.*, u.email AS user_email, u.name AS user_name
       FROM invoices i
       JOIN users u ON u.id = i.user_id
       ORDER BY i.created_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async findByAsaasPaymentId(asaasPaymentId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM invoices WHERE asaas_payment_id = $1',
      [asaasPaymentId]
    );
    return rows[0] || null;
  }

  async findById(id) {
    const { rows } = await this.pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByIdForUser(id, userId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rows[0] || null;
  }

  async upsertFromAsaas(data) {
    const existing = data.asaas_payment_id
      ? await this.findByAsaasPaymentId(data.asaas_payment_id)
      : null;

    if (existing) {
      const { rows } = await this.pool.query(
        `UPDATE invoices SET
          status = COALESCE($2, status),
          amount = COALESCE($3, amount),
          due_date = COALESCE($4, due_date),
          invoice_url = COALESCE($5, invoice_url),
          bank_slip_url = COALESCE($6, bank_slip_url),
          pix_qrcode = COALESCE($7, pix_qrcode),
          pix_copy_paste = COALESCE($8, pix_copy_paste),
          paid_at = COALESCE($9, paid_at),
          updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [
          existing.id, data.status, data.amount, data.due_date,
          data.invoice_url, data.bank_slip_url, data.pix_qrcode,
          data.pix_copy_paste, data.paid_at,
        ]
      );
      return rows[0];
    }

    const { rows } = await this.pool.query(
      `INSERT INTO invoices (
        user_id, subscription_id, asaas_payment_id, description, amount, due_date,
        status, billing_type, invoice_url, bank_slip_url, pix_qrcode, pix_copy_paste, paid_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        data.user_id, data.subscription_id || null, data.asaas_payment_id,
        data.description, data.amount, data.due_date, data.status || 'pending',
        data.billing_type, data.invoice_url, data.bank_slip_url,
        data.pix_qrcode, data.pix_copy_paste, data.paid_at || null,
      ]
    );
    return rows[0];
  }

  async getNextDueForUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM invoices
       WHERE user_id = $1 AND status IN ('pending', 'overdue')
       ORDER BY due_date ASC NULLS LAST LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  }

  async countOverdueByUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM invoices
       WHERE user_id = $1 AND status = 'overdue'`,
      [userId]
    );
    return rows[0].count;
  }
}

let instance = null;

function getInvoiceRepository() {
  if (!instance) instance = new InvoiceRepository();
  return instance;
}

module.exports = { InvoiceRepository, getInvoiceRepository };
