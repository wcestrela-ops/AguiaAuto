const whatsapp = require('./whatsapp');
const sms = require('./sms');
const logger = require('../logger');
const { getBillingNotificationRepository } = require('../repositories/billing-notification-repository');
const {
  getBillingConfig,
  renderTemplate,
  buildInvoiceMessageVars,
} = require('../lib/billing-templates');

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

async function sendBillingMessage(phone, text, meta = {}, channelOptions = {}) {
  const { invoiceId, userId, userRef, trigger } = resolveMetaIds(meta);
  const {
    smsEnabled = false,
    smsOnly = false,
  } = channelOptions;

  const base = {
    invoice_id: invoiceId,
    user_id: userId,
    phone,
    trigger,
    reminder_offset_days: meta.reminderOffsetDays ?? null,
  };

  if (smsOnly && smsEnabled) {
    try {
      const result = await sms.sendText({
        to: phone,
        text,
        user: userId || userRef,
        action: trigger,
      });
      return recordNotification(base, {
        channel: 'sms',
        used_fallback: false,
        status: 'sent',
        provider_type: result?.provider || null,
        external_ref: result?.provider_id != null ? String(result.provider_id) : null,
      });
    } catch (smsErr) {
      await recordNotification(base, {
        channel: 'sms',
        used_fallback: false,
        status: 'failed',
        error_message: smsErr.message,
      });
      throw smsErr;
    }
  }

  try {
    const result = await whatsapp.sendText({ to: phone, text }, { user: userRef, ...meta });
    return recordNotification(base, {
      channel: 'whatsapp',
      used_fallback: false,
      status: 'sent',
      provider_type: result?.provider || null,
      external_ref: result?.provider_id != null ? String(result.provider_id) : null,
    });
  } catch (waErr) {
    if (!smsEnabled) {
      await recordNotification(base, {
        channel: 'whatsapp',
        used_fallback: false,
        status: 'failed',
        error_message: waErr.message,
      });
      throw waErr;
    }

    logger.warn('Cobrança via WhatsApp falhou — tentando SMS.', {
      phone,
      invoiceId,
      userId,
      trigger,
      err: waErr.message,
    });

    try {
      const result = await sms.sendText({
        to: phone,
        text,
        user: userId || userRef,
        action: trigger,
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

async function sendTemplatedBillingMessage(phone, templateKey, vars, meta = {}, channelOptions = {}) {
  const settings = await getBillingConfig();
  const template = settings[templateKey];
  const text = renderTemplate(template, vars);
  if (!text.trim()) {
    throw new Error(`Template "${templateKey}" vazio. Configure em Integrações → Cobrança.`);
  }
  return sendBillingMessage(phone, text, meta, channelOptions);
}

async function sendBillingReminder(phone, payload, meta = {}) {
  const settings = await getBillingConfig();
  const vars = {
    cliente: meta.clientName || meta.cliente || 'Cliente',
    valor: payload.valor,
    vencimento: payload.vencimento,
    link: payload.link || '',
    descricao: payload.descricao || 'Mensalidade',
    dias_atraso: payload.dias_atraso || '0',
    data_pagamento: payload.data_pagamento || '',
  };

  return sendTemplatedBillingMessage(
    phone,
    meta.templateKey || 'template_new_charge',
    vars,
    meta,
    {
      smsEnabled: settings.reminder_sms_enabled === true || settings.reminder_sms_enabled === 'true',
      smsOnly: settings.reminder_sms_only === true || settings.reminder_sms_only === 'true',
    },
  );
}

async function sendPaymentReceivedNotification(phone, { invoice, user }, meta = {}) {
  const settings = await getBillingConfig();
  const vars = buildInvoiceMessageVars({ invoice, user });
  const trigger = meta.trigger || 'billing.payment_received';

  const alreadySent = await getBillingNotificationRepository()
    .hasSentForTrigger(invoice.id, trigger);
  if (alreadySent) {
    return { skipped: true, reason: 'already_sent' };
  }

  return sendTemplatedBillingMessage(
    phone,
    'template_payment_received',
    vars,
    {
      ...meta,
      invoiceId: invoice.id,
      userId: user.id,
      user: user.email,
      trigger,
    },
    {
      smsEnabled: settings.payment_received_sms_enabled === true
        || settings.payment_received_sms_enabled === 'true',
      smsOnly: false,
    },
  );
}

module.exports = {
  sendBillingMessage,
  sendTemplatedBillingMessage,
  sendBillingReminder,
  sendPaymentReceivedNotification,
};
