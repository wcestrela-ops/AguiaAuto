const whatsapp = require('./whatsapp');
const sms = require('./sms');
const logger = require('../logger');
const { getBillingNotificationRepository } = require('../repositories/billing-notification-repository');

function resolveMetaIds(meta = {}) {
  const userId = meta.userId || meta.user_id || null;
  const userRef = userId || meta.user || meta.userEmail || null;
  return {
    invoiceId: meta.invoiceId || meta.invoice_id || null,
    userId,
    userRef,
    trigger: meta.trigger || 'billing.reminder',
  };
}

async function recordNotification(base, fields) {
  const repo = getBillingNotificationRepository();
  const row = await repo.create({ ...base, ...fields });
  return {
    channel: row.channel,
    used_fallback: row.used_fallback,
    status: row.status,
    notification: row,
  };
}

async function sendBillingReminder(phone, payload, meta = {}) {
  const { invoiceId, userId, userRef, trigger } = resolveMetaIds(meta);
  const base = {
    invoice_id: invoiceId,
    user_id: userId,
    phone,
    trigger,
  };

  try {
    const result = await whatsapp.sendBillingReminder(phone, payload, { user: userRef, ...meta });
    return recordNotification(base, {
      channel: 'whatsapp',
      used_fallback: false,
      status: 'sent',
      provider_type: result?.provider || null,
      external_ref: result?.provider_id != null ? String(result.provider_id) : null,
    });
  } catch (waErr) {
    logger.warn('Cobrança via WhatsApp falhou — tentando SMS.', {
      phone,
      invoiceId,
      userId,
      err: waErr.message,
    });

    try {
      const result = await sms.sendBillingReminder(phone, payload, {
        user: userId || userRef,
        userId,
        ...meta,
      });

      return recordNotification(base, {
        channel: 'sms',
        used_fallback: true,
        status: 'sent',
        provider_type: result?.provider || null,
        external_ref: result?.provider_id != null ? String(result.provider_id) : null,
        error_message: waErr.message,
      });
    } catch (smsErr) {
      await recordNotification(base, {
        channel: 'sms',
        used_fallback: true,
        status: 'failed',
        error_message: `WhatsApp: ${waErr.message}; SMS: ${smsErr.message}`,
      });
      throw smsErr;
    }
  }
}

module.exports = { sendBillingReminder };
