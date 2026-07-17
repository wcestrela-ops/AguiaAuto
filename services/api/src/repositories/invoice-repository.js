const { getPool } = require('../db/pool');
const { isMultiTenantEnabled, DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const { tenantWhereClause, assertResourceTenant } = require('../lib/tenant/tenant-query');

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

  async listAll({ limit = 100, tenantId = DEFAULT_TENANT_ID } = {}) {
    const params = [limit];
    let tenantFilter = '';
    if (isMultiTenantEnabled()) {
      tenantFilter = ' AND i.tenant_id = $2';
      params.push(tenantId);
    }
    const { rows } = await this.pool.query(
      `SELECT i.*, u.email AS user_email, u.name AS user_name
       FROM invoices i
       JOIN users u ON u.id = i.user_id
       WHERE 1=1${tenantFilter}
       ORDER BY i.created_at DESC LIMIT $1`,
      params,
    );
    return rows;
  }

  async findByExternalPayment(provider, externalPaymentId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM invoices
       WHERE payment_provider = $1 AND external_payment_id = $2`,
      [provider, externalPaymentId]
    );
    return rows[0] || null;
  }

  async findByAsaasPaymentId(asaasPaymentId) {
    return this.findByExternalPayment('asaas', asaasPaymentId);
  }

  async findById(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = 'SELECT * FROM invoices WHERE id = $1';
    if (isMultiTenantEnabled()) {
      const filter = tenantWhereClause(tenantId, { paramIndex: 2 });
      sql += filter.clause;
      params.push(...filter.params);
    }
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async findByIdForUser(id, userId, tenantId = DEFAULT_TENANT_ID) {
    const params = [id, userId];
    let sql = 'SELECT * FROM invoices WHERE id = $1 AND user_id = $2';
    if (isMultiTenantEnabled()) {
      const filter = tenantWhereClause(tenantId, { paramIndex: 3 });
      sql += filter.clause;
      params.push(...filter.params);
    }
    const { rows } = await this.pool.query(sql, params);
    return rows[0] || null;
  }

  async upsertFromPayment(data) {
    const provider = data.payment_provider || data.provider || 'asaas';
    const externalId = data.external_payment_id || data.asaas_payment_id;

    const existing = externalId
      ? await this.findByExternalPayment(provider, externalId)
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
        billing_type = COALESCE($10, billing_type),
        paid_via = CASE
          WHEN COALESCE($2, status) = 'paid' AND paid_via IS NULL THEN 'gateway'
          ELSE paid_via
        END,
        updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [
          existing.id, data.status, data.amount, data.due_date,
          data.invoice_url, data.bank_slip_url, data.pix_qrcode,
          data.pix_copy_paste, data.paid_at, data.billing_type,
        ]
      );
      return rows[0];
    }

    const { rows } = await this.pool.query(
      `INSERT INTO invoices (
        user_id, subscription_id, payment_provider, external_payment_id, asaas_payment_id,
        description, amount, due_date, status, billing_type,
        invoice_url, bank_slip_url, pix_qrcode, pix_copy_paste, paid_at, is_initial_charge
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        data.user_id,
        data.subscription_id || null,
        provider,
        externalId,
        provider === 'asaas' ? externalId : null,
        data.description,
        data.amount,
        data.due_date,
        data.status || 'pending',
        data.billing_type,
        data.invoice_url,
        data.bank_slip_url,
        data.pix_qrcode,
        data.pix_copy_paste,
        data.paid_at || null,
        data.is_initial_charge || false,
      ]
    );
    return rows[0];
  }

  async upsertFromAsaas(data) {
    return this.upsertFromPayment({
      ...data,
      payment_provider: 'asaas',
      external_payment_id: data.asaas_payment_id || data.external_payment_id,
    });
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

  async findNextPendingMonthly(userId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM invoices
       WHERE user_id = $1
         AND status = 'pending'
         AND is_initial_charge = false
       ORDER BY due_date ASC NULLS LAST, created_at ASC
       LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  }

  async findPendingMonthlyForMonth(userId, yearMonth) {
    const { rows } = await this.pool.query(
      `SELECT * FROM invoices
       WHERE user_id = $1
         AND status = 'pending'
         AND is_initial_charge = false
         AND to_char(due_date, 'YYYY-MM') = $2
       ORDER BY due_date ASC NULLS LAST, created_at ASC
       LIMIT 1`,
      [userId, yearMonth]
    );
    return rows[0] || null;
  }

  async applyReferralDiscount(invoiceId, {
    amount,
    original_amount,
    discount_percent,
    referral_id,
    payment,
    status,
    description,
  }) {
    const { rows } = await this.pool.query(
      `UPDATE invoices SET
        original_amount = COALESCE($2, original_amount),
        discount_percent = COALESCE($3, discount_percent),
        referral_id = COALESCE($4, referral_id),
        amount = COALESCE($5, amount),
        status = COALESCE($6, status),
        description = COALESCE($7, description),
        invoice_url = COALESCE($8, invoice_url),
        bank_slip_url = COALESCE($9, bank_slip_url),
        pix_qrcode = COALESCE($10, pix_qrcode),
        pix_copy_paste = COALESCE($11, pix_copy_paste),
        paid_at = COALESCE($12, paid_at),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        invoiceId,
        original_amount,
        discount_percent,
        referral_id,
        amount,
        status || null,
        description || payment?.description || null,
        payment?.invoice_url || null,
        payment?.bank_slip_url || null,
        payment?.pix_qrcode || null,
        payment?.pix_copy_paste || null,
        status === 'waived' || status === 'paid' ? new Date().toISOString() : null,
      ]
    );
    return rows[0];
  }

  async countOverdueByUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM invoices
       WHERE user_id = $1 AND status = 'overdue'`,
      [userId]
    );
    return rows[0].count;
  }

  async listForReminderOffset(daysAfterDue) {
    const { rows } = await this.pool.query(
      `SELECT i.*, u.email AS user_email, u.name AS user_name, u.phone AS user_phone
       FROM invoices i
       JOIN users u ON u.id = i.user_id
       WHERE i.status IN ('pending', 'overdue')
         AND i.due_date IS NOT NULL
         AND u.phone IS NOT NULL
         AND TRIM(u.phone) <> ''
         AND (i.due_date + ($1 || ' days')::interval)::date = CURRENT_DATE
       ORDER BY i.due_date ASC`,
      [String(daysAfterDue)],
    );
    return rows;
  }

  async listUserIdsForReminderOffset(daysAfterDue) {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT i.user_id
       FROM invoices i
       JOIN users u ON u.id = i.user_id
       WHERE i.status IN ('pending', 'overdue')
         AND i.due_date IS NOT NULL
         AND u.phone IS NOT NULL
         AND TRIM(u.phone) <> ''
         AND (i.due_date + ($1 || ' days')::interval)::date = CURRENT_DATE
       ORDER BY i.user_id`,
      [String(daysAfterDue)],
    );
    return rows.map((row) => row.user_id);
  }

  async listOpenInvoicesForUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM invoices
       WHERE user_id = $1
         AND status IN ('pending', 'overdue')
       ORDER BY due_date ASC NULLS LAST, created_at ASC`,
      [userId],
    );
    return rows;
  }

  async markPaidManually(id, { notes } = {}) {
    const { rows } = await this.pool.query(
      `UPDATE invoices SET
        status = 'paid',
        paid_at = NOW(),
        paid_via = 'manual',
        payment_provider = COALESCE(payment_provider, 'manual'),
        manual_payment_notes = COALESCE($2, manual_payment_notes),
        updated_at = NOW()
       WHERE id = $1
         AND status NOT IN ('paid', 'waived', 'refunded')
       RETURNING *`,
      [id, notes || null],
    );
    if (!rows[0]) throw new Error('Fatura não encontrada ou já quitada.');
    return rows[0];
  }
}

let instance = null;

function getInvoiceRepository() {
  if (!instance) instance = new InvoiceRepository();
  return instance;
}

module.exports = { InvoiceRepository, getInvoiceRepository };
