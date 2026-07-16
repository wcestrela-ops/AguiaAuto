const whatsapp = require('./whatsapp');
const sms = require('./sms');
const logger = require('../logger');
const { getFleetReminderNotificationRepository } = require('../repositories/fleet-reminder-notification-repository');
const {
  getFleetReminderConfig,
  isSmsEnabled,
  isSmsOnly,
  isWhatsappEnabled,
} = require('../lib/fleet-reminder-config');
const { renderTemplate, buildFleetReminderVars } = require('../lib/fleet-templates');

const DAILY_TRIGGER = 'fleet.reminder.daily';

async function recordFleetNotification(base, fields) {
  const row = await getFleetReminderNotificationRepository().create({ ...base, ...fields });
  return {
    channel: row.channel,
    used_fallback: row.used_fallback,
    status: row.status,
    notification: row,
  };
}

async function sendFleetMessage(phone, text, meta = {}, channelOptions = {}) {
  const {
    userId,
    userRef,
    trigger = DAILY_TRIGGER,
    documentsCount = 0,
    maintenanceCount = 0,
    itemsSnapshot = [],
  } = meta;
  const {
    smsEnabled = false,
    smsOnly = false,
    whatsappEnabled = true,
  } = channelOptions;

  const base = {
    user_id: userId,
    trigger,
    phone,
    documents_count: documentsCount,
    maintenance_count: maintenanceCount,
    items_snapshot: itemsSnapshot,
  };

  if (smsOnly && smsEnabled) {
    try {
      const result = await sms.sendText({
        to: phone,
        text,
        user: userId || userRef,
        action: trigger,
      });
      return recordFleetNotification(base, {
        channel: 'sms',
        used_fallback: false,
        status: 'sent',
        provider_type: result?.provider || null,
        external_ref: result?.provider_id != null ? String(result.provider_id) : null,
      });
    } catch (smsErr) {
      await recordFleetNotification(base, {
        channel: 'sms',
        used_fallback: false,
        status: 'failed',
        error_message: smsErr.message,
      });
      throw smsErr;
    }
  }

  if (!whatsappEnabled) {
    throw new Error('WhatsApp desabilitado para lembretes de frota.');
  }

  try {
    const result = await whatsapp.sendText({ to: phone, text }, { user: userRef, ...meta });
    return recordFleetNotification(base, {
      channel: 'whatsapp',
      used_fallback: false,
      status: 'sent',
      provider_type: result?.provider || null,
      external_ref: result?.provider_id != null ? String(result.provider_id) : null,
    });
  } catch (waErr) {
    if (!smsEnabled) {
      await recordFleetNotification(base, {
        channel: 'whatsapp',
        used_fallback: false,
        status: 'failed',
        error_message: waErr.message,
      });
      throw waErr;
    }

    logger.warn('Lembrete de frota via WhatsApp falhou — tentando SMS.', {
      phone,
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

      return recordFleetNotification(base, {
        channel: 'sms',
        used_fallback: true,
        status: 'sent',
        provider_type: result?.provider || null,
        external_ref: result?.provider_id != null ? String(result.provider_id) : null,
        error_message: waErr.message,
      });
    } catch (smsErr) {
      await recordFleetNotification(base, {
        channel: 'sms',
        used_fallback: true,
        status: 'failed',
        error_message: `WhatsApp: ${waErr.message}; SMS: ${smsErr.message}`,
      });
      throw smsErr;
    }
  }
}

async function sendTemplatedFleetReminder(phone, { user, documents, maintenance, userId, itemsSnapshot }) {
  const settings = await getFleetReminderConfig();
  const template = settings.template_fleet_reminder;
  const vars = buildFleetReminderVars({ user, documents, maintenance });
  const text = renderTemplate(template, vars);

  if (!text.trim()) {
    throw new Error('Template de lembrete de frota vazio. Configure em Integrações → Documentos e Manutenção.');
  }

  return sendFleetMessage(
    phone,
    text,
    {
      userId,
      userRef: user?.email || userId,
      trigger: DAILY_TRIGGER,
      documentsCount: documents.length,
      maintenanceCount: maintenance.length,
      itemsSnapshot,
    },
    {
      smsEnabled: isSmsEnabled(settings),
      smsOnly: isSmsOnly(settings),
      whatsappEnabled: isWhatsappEnabled(settings),
    },
  );
}

module.exports = {
  sendFleetMessage,
  sendTemplatedFleetReminder,
};
