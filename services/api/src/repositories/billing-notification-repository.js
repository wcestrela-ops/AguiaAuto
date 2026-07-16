const { getPool } = require('../db/pool');

function formatNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    invoice_id: row.invoice_id,
    user_id: row.user_id,
    phone: row.phone,
    channel: row.channel,
    used_fallback: row.used_fallback,
    status: row.status,
    trigger: row.trigger,
    provider_type: row.provider_type,
    external_ref: row.external_ref,
    error_message: row.error_message,
    created_at: row.created_at,
    user_name: row.user_name || null,
    user_email: row.user_email || null,
    invoice_description: row.invoice_description || null,
  };
}

class BillingNotificationRepository {
  constructor() {
    this.pool = getPool();
  }

  async create(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO billing_notifications (
        invoice_id, user_id, phone, channel, used_fallback, status,
        trigger, provider_type, external_ref, error_message, reminder_offset_days,
        consolidated_invoice_ids
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        data.invoice_id || null,
        data.user_id || null,
        data.phone,
        data.channel,
        Boolean(data.used_fallback),
        data.status || 'sent',
        data.trigger || 'billing.reminder',
        data.provider_type || null,
        data.external_ref || null,
        data.error_message || null,
        data.reminder_offset_days ?? null,
        data.consolidated_invoice_ids ? JSON.stringify(data.consolidated_invoice_ids) : null,
      ],
    );
    return rows[0];
  }

  async hasSentForUserTriggerToday(userId, trigger) {
    if (!userId || !trigger) return false;
    const { rows } = await this.pool.query(
      `SELECT 1 FROM billing_notifications
       WHERE user_id = $1
         AND trigger = $2
         AND status = 'sent'
         AND created_at::date = CURRENT_DATE
       LIMIT 1`,
      [userId, trigger],
    );
    return rows.length > 0;
  }

  async hasSentForTrigger(invoiceId, trigger) {
    if (!invoiceId || !trigger) return false;
    const { rows } = await this.pool.query(
      `SELECT 1 FROM billing_notifications
       WHERE invoice_id = $1 AND trigger = $2 AND status = 'sent'
       LIMIT 1`,
      [invoiceId, trigger],
    );
    return rows.length > 0;
  }

  async listRecent({ limit = 50, channel, invoiceId } = {}) {
    const params = [];
    const conditions = [];

    if (channel) {
      params.push(channel);
      conditions.push(`bn.channel = $${params.length}`);
    }
    if (invoiceId) {
      params.push(Number(invoiceId));
      conditions.push(`bn.invoice_id = $${params.length}`);
    }

    params.push(Math.min(limit, 200));
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT bn.*, u.name AS user_name, u.email AS user_email, i.description AS invoice_description
       FROM billing_notifications bn
       LEFT JOIN users u ON u.id = bn.user_id
       LEFT JOIN invoices i ON i.id = bn.invoice_id
       ${where}
       ORDER BY bn.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows.map(formatNotification);
  }

  async mapLatestByInvoiceIds(invoiceIds = []) {
    if (!invoiceIds.length) return new Map();

    const { rows } = await this.pool.query(
      `SELECT DISTINCT ON (matched_invoice_id) *
       FROM (
         SELECT bn.*, bn.invoice_id AS matched_invoice_id
         FROM billing_notifications bn
         WHERE bn.invoice_id = ANY($1::int[])
         UNION ALL
         SELECT bn.*, cid::int AS matched_invoice_id
         FROM billing_notifications bn,
              jsonb_array_elements_text(bn.consolidated_invoice_ids) AS cid
         WHERE bn.consolidated_invoice_ids IS NOT NULL
           AND cid::int = ANY($1::int[])
       ) matched
       ORDER BY matched_invoice_id, created_at DESC`,
      [invoiceIds],
    );

    return new Map(rows.map((row) => [row.matched_invoice_id, formatNotification(row)]));
  }

  async countSince(hours, { channel, usedFallback, status } = {}) {
    const params = [String(hours)];
    const conditions = [`created_at >= NOW() - ($1 || ' hours')::interval`];

    if (channel) {
      params.push(channel);
      conditions.push(`channel = $${params.length}`);
    }
    if (usedFallback != null) {
      params.push(Boolean(usedFallback));
      conditions.push(`used_fallback = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM billing_notifications WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return rows[0].count;
  }

  async listRecentFailed(limit = 10) {
    const { rows } = await this.pool.query(
      `SELECT bn.*, u.name AS user_name, u.email AS user_email, i.description AS invoice_description
       FROM billing_notifications bn
       LEFT JOIN users u ON u.id = bn.user_id
       LEFT JOIN invoices i ON i.id = bn.invoice_id
       WHERE bn.status = 'failed'
       ORDER BY bn.created_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map(formatNotification);
  }
}

let instance = null;

function getBillingNotificationRepository() {
  if (!instance) instance = new BillingNotificationRepository();
  return instance;
}

module.exports = { BillingNotificationRepository, getBillingNotificationRepository, formatNotification };
