const { getPool } = require('../db/pool');
const { getInvoiceRepository } = require('../repositories/invoice-repository');
const { getBillingNotificationRepository } = require('../repositories/billing-notification-repository');
const {
  sendTemplatedBillingMessage,
  sendPaymentReceivedNotification,
} = require('./billing-notifications');
const { prepareConsolidatedBillingContext } = require('./billing-consolidation-service');
const {
  getBillingConfig,
  getEnabledReminderOffsets,
} = require('../lib/billing-templates');
const { normalizePhone } = require('../lib/phone');
const logger = require('../logger');

class BillingReminderService {
  constructor() {
    this.pool = getPool();
    this.invoices = getInvoiceRepository();
    this.notifications = getBillingNotificationRepository();
    this.runInProgress = false;
    this.lastRun = null;
  }

  async getStatus() {
    const settings = await getBillingConfig();
    return {
      integration_enabled: settings.integrationEnabled,
      auto_reminders_enabled: settings.auto_reminders_enabled,
      reminder_check_interval_hours: settings.reminder_check_interval_hours,
      enabled_offsets: getEnabledReminderOffsets(settings).map((o) => o.days),
      reminder_sms_enabled: settings.reminder_sms_enabled,
      reminder_sms_only: settings.reminder_sms_only,
      consolidated_reminders: true,
      last_run: this.lastRun,
    };
  }

  async runScheduledReminders() {
    if (this.runInProgress) return { skipped: true };

    const settings = await getBillingConfig();
    if (!settings.integrationEnabled || !settings.auto_reminders_enabled) {
      return { skipped: true, reason: 'disabled' };
    }

    this.runInProgress = true;
    const startedAt = new Date();
    const offsets = getEnabledReminderOffsets(settings);
    let remindersSent = 0;
    let errorsCount = 0;
    const details = [];

    try {
      for (const offset of offsets) {
        const userIds = await this.invoices.listUserIdsForReminderOffset(offset.days);
        for (const userId of userIds) {
          try {
            const sent = await this._sendConsolidatedReminder(userId, offset, settings);
            if (sent) {
              remindersSent += 1;
              details.push({
                user_id: userId,
                trigger: offset.trigger,
                status: 'sent',
                invoices: sent.invoiceIds,
              });
            }
          } catch (err) {
            errorsCount += 1;
            details.push({
              user_id: userId,
              trigger: offset.trigger,
              status: 'failed',
              error: err.message,
            });
            logger.warn('Lembrete automático consolidado falhou.', { userId, err: err.message });
          }
        }
      }

      const finishedAt = new Date();
      await this.pool.query(
        `INSERT INTO billing_reminder_runs (started_at, finished_at, reminders_sent, errors_count, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [startedAt, finishedAt, remindersSent, errorsCount, JSON.stringify(details)],
      );

      this.lastRun = {
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        reminders_sent: remindersSent,
        errors_count: errorsCount,
      };

      return this.lastRun;
    } finally {
      this.runInProgress = false;
    }
  }

  async _sendConsolidatedReminder(userId, offset, settings) {
    if (await this.notifications.hasSentForUserTriggerToday(userId, offset.trigger)) {
      return false;
    }

    const context = await prepareConsolidatedBillingContext(userId, {
      daysOverdue: offset.days,
    });
    if (!context?.hasPayment) return false;

    const { user, vars, openInvoices, primaryInvoice } = context;
    if (!user?.phone) return false;

    await sendTemplatedBillingMessage(
      normalizePhone(user.phone),
      offset.templateKey,
      vars,
      {
        invoiceId: primaryInvoice.id,
        userId: user.id,
        user: user.email,
        clientName: user.name,
        trigger: offset.trigger,
        reminderOffsetDays: offset.days,
        consolidatedInvoiceIds: openInvoices.map((inv) => inv.id),
      },
      {
        smsEnabled: settings.reminder_sms_enabled === true || settings.reminder_sms_enabled === 'true',
        smsOnly: settings.reminder_sms_only === true || settings.reminder_sms_only === 'true',
      },
    );

    return {
      invoiceIds: openInvoices.map((inv) => inv.id),
    };
  }

  async notifyPaymentReceived(invoice, user, { trigger = 'billing.payment_received' } = {}) {
    const settings = await getBillingConfig();
    if (!settings.integrationEnabled) return { skipped: true };

    const notifyAuto = settings.notify_payment_received_auto === true
      || settings.notify_payment_received_auto === 'true';
    const notifyManual = settings.notify_payment_received_manual === true
      || settings.notify_payment_received_manual === 'true';

    const isManual = trigger === 'billing.payment_received.manual';
    if (isManual && !notifyManual) return { skipped: true, reason: 'manual_disabled' };
    if (!isManual && !notifyAuto) return { skipped: true, reason: 'auto_disabled' };

    if (!user?.phone) return { skipped: true, reason: 'no_phone' };

    return sendPaymentReceivedNotification(
      normalizePhone(user.phone),
      { invoice, user },
      { trigger },
    );
  }
}

let instance = null;

function getBillingReminderService() {
  if (!instance) instance = new BillingReminderService();
  return instance;
}

function startBillingReminderPoller(checkIntervalMs) {
  const settingsHours = parseInt(process.env.BILLING_REMINDER_CHECK_HOURS || '1', 10);
  const intervalMs = checkIntervalMs || settingsHours * 60 * 60 * 1000;

  const run = async () => {
    try {
      await getBillingReminderService().runScheduledReminders();
    } catch (err) {
      logger.warn('Poller lembretes de cobrança falhou.', { err: err.message });
    }
  };

  run();
  return setInterval(run, intervalMs);
}

module.exports = {
  BillingReminderService,
  getBillingReminderService,
  startBillingReminderPoller,
};
