const { getPool } = require('../db/pool');
const { getVehicleDocumentRepository } = require('../repositories/vehicle-document-repository');
const { getVehicleMaintenanceRepository } = require('../repositories/vehicle-maintenance-repository');
const { getFleetReminderNotificationRepository } = require('../repositories/fleet-reminder-notification-repository');
const {
  getFleetReminderConfig,
  isAutoRemindersEnabled,
  isPushEnabled,
} = require('../lib/fleet-reminder-config');
const {
  formatDocument,
  formatMaintenance,
  expiryStatus,
} = require('./vehicle-fleet-service');
const firebase = require('../integrations/firebase');
const logger = require('../logger');

const DAILY_TRIGGER = 'fleet.reminder.daily';

function buildReminderMessage(documents, maintenance) {
  const expiredDocs = documents.filter((row) => expiryStatus(row.expiry_date) === 'vencido');
  const expiringDocs = documents.filter((row) => expiryStatus(row.expiry_date) === 'vencendo');
  const overdueMaint = maintenance.filter((row) => expiryStatus(row.next_due_date) === 'vencido');
  const dueMaint = maintenance.filter((row) => expiryStatus(row.next_due_date) === 'vencendo');

  const parts = [];
  if (expiredDocs.length) parts.push(`${expiredDocs.length} documento(s) vencido(s)`);
  if (expiringDocs.length) parts.push(`${expiringDocs.length} documento(s) vencendo`);
  if (overdueMaint.length) parts.push(`${overdueMaint.length} manutenção(ões) atrasada(s)`);
  if (dueMaint.length) parts.push(`${dueMaint.length} manutenção(ões) próxima(s)`);

  const title = expiredDocs.length || overdueMaint.length
    ? '⚠️ Documentos ou manutenção em atraso'
    : '📋 Lembrete de documentos e manutenção';

  const body = parts.length
    ? `${parts.join(' · ')}. Toque para ver detalhes.`
    : 'Confira vencimentos na área Documentos e Manutenção.';

  return { title, body };
}

function buildItemsSnapshot(documents, maintenance) {
  return [
    ...documents.slice(0, 10).map((row) => {
      const doc = formatDocument(row);
      return {
        kind: 'document',
        id: doc.id,
        title: doc.title,
        plate: doc.plate,
        date: doc.expiry_date,
        status: doc.expiry_status,
      };
    }),
    ...maintenance.slice(0, 10).map((row) => {
      const item = formatMaintenance(row);
      return {
        kind: 'maintenance',
        id: item.id,
        title: item.title,
        plate: item.plate,
        date: item.next_due_date,
        status: item.due_status,
      };
    }),
  ];
}

class FleetReminderService {
  constructor() {
    this.pool = getPool();
    this.documents = getVehicleDocumentRepository();
    this.maintenance = getVehicleMaintenanceRepository();
    this.notifications = getFleetReminderNotificationRepository();
    this.runInProgress = false;
    this.lastRun = null;
  }

  async getStatus() {
    const settings = await getFleetReminderConfig();
    return {
      integration_enabled: settings.integrationEnabled,
      auto_reminders_enabled: isAutoRemindersEnabled(settings),
      reminder_check_interval_hours: settings.reminder_check_interval_hours,
      warning_days: settings.warning_days,
      reminder_push_enabled: isPushEnabled(settings),
      last_run: this.lastRun,
    };
  }

  async runScheduledReminders({ force = false } = {}) {
    if (this.runInProgress) return { skipped: true, reason: 'in_progress' };

    const settings = await getFleetReminderConfig();
    if (!force && (!settings.integrationEnabled || !isAutoRemindersEnabled(settings))) {
      return { skipped: true, reason: 'disabled' };
    }
    if (!force && !isPushEnabled(settings)) {
      return { skipped: true, reason: 'push_disabled' };
    }

    this.runInProgress = true;
    const startedAt = new Date();
    const warningDays = Number(settings.warning_days) || 30;
    let remindersSent = 0;
    let errorsCount = 0;
    const details = [];

    try {
      const [docUserIds, maintUserIds] = await Promise.all([
        this.documents.listUserIdsNeedingReminder(warningDays),
        this.maintenance.listUserIdsNeedingReminder(warningDays),
      ]);
      const userIds = [...new Set([...docUserIds, ...maintUserIds])];

      for (const userId of userIds) {
        try {
          const sent = await this._sendDailyReminder(userId, warningDays);
          if (sent) {
            remindersSent += 1;
            details.push({
              user_id: userId,
              trigger: DAILY_TRIGGER,
              status: 'sent',
              documents: sent.documentsCount,
              maintenance: sent.maintenanceCount,
            });
          }
        } catch (err) {
          errorsCount += 1;
          details.push({
            user_id: userId,
            trigger: DAILY_TRIGGER,
            status: 'failed',
            error: err.message,
          });
          logger.warn('Lembrete automático de frota falhou.', { userId, err: err.message });
        }
      }

      const finishedAt = new Date();
      await this.pool.query(
        `INSERT INTO fleet_reminder_runs (started_at, finished_at, reminders_sent, errors_count, details)
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

  async _sendDailyReminder(userId, warningDays) {
    if (await this.notifications.hasSentForUserTriggerToday(userId, DAILY_TRIGGER)) {
      return false;
    }

    const [docRows, maintRows] = await Promise.all([
      this.documents.listNeedingReminderForUser(userId, warningDays),
      this.maintenance.listNeedingReminderForUser(userId, warningDays),
    ]);

    if (docRows.length === 0 && maintRows.length === 0) {
      return false;
    }

    const { title, body } = buildReminderMessage(docRows, maintRows);
    const itemsSnapshot = buildItemsSnapshot(docRows, maintRows);

    try {
      const pushResult = await firebase.sendPushToUser(userId, {
        title,
        body,
        data: {
          type: 'fleet_reminder',
          trigger: DAILY_TRIGGER,
          documents_count: String(docRows.length),
          maintenance_count: String(maintRows.length),
          path: '/app/frota',
        },
      });

      if (!pushResult.success) {
        throw new Error(pushResult.errors?.[0]?.error || 'Push não entregue — nenhum dispositivo ativo.');
      }

      await this.notifications.create({
        user_id: userId,
        trigger: DAILY_TRIGGER,
        channel: 'push',
        status: 'sent',
        documents_count: docRows.length,
        maintenance_count: maintRows.length,
        items_snapshot: itemsSnapshot,
      });

      return {
        documentsCount: docRows.length,
        maintenanceCount: maintRows.length,
      };
    } catch (err) {
      await this.notifications.create({
        user_id: userId,
        trigger: DAILY_TRIGGER,
        channel: 'push',
        status: 'failed',
        documents_count: docRows.length,
        maintenance_count: maintRows.length,
        items_snapshot: itemsSnapshot,
        error_message: err.message,
      });
      throw err;
    }
  }
}

let instance = null;

function getFleetReminderService() {
  if (!instance) instance = new FleetReminderService();
  return instance;
}

function startFleetReminderPoller(checkIntervalMs) {
  const settingsHours = parseInt(process.env.FLEET_REMINDER_CHECK_HOURS || '6', 10);
  const intervalMs = checkIntervalMs || settingsHours * 60 * 60 * 1000;

  const run = async () => {
    try {
      await getFleetReminderService().runScheduledReminders();
    } catch (err) {
      logger.warn('Poller lembretes de frota falhou.', { err: err.message });
    }
  };

  run();
  return setInterval(run, intervalMs);
}

module.exports = {
  FleetReminderService,
  getFleetReminderService,
  startFleetReminderPoller,
  buildReminderMessage,
  buildItemsSnapshot,
};
