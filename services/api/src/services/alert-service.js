const { getStore } = require('@aguia/integrations');
const { VEHICLE_ALERT_CHANNELS, filterVehicleAlertChannels } = require('../lib/notification-policy');
const { ALERT_TYPES } = require('@aguia/shared');
const { getAlertRepository } = require('../repositories/alert-repository');
const { getAlertPreferenceRepository } = require('../repositories/alert-preference-repository');
const { getVehicleRepository } = require('../repositories/vehicle-repository');
const { getUserRepository } = require('../repositories/user-repository');
const { normalizeGpswoxPayload, ALERT_TYPE_LABELS } = require('../lib/gpswox-events');
const firebase = require('./firebase');
const logger = require('../logger');

function formatAlert(row) {
  return {
    id: row.id,
    alert_type: row.alert_type,
    alert_type_label: ALERT_TYPE_LABELS[row.alert_type] || row.alert_type,
    title: row.title,
    message: row.message,
    vehicle_id: row.vehicle_id,
    vehicle_plate: row.plate || row.vehicle_plate || null,
    device_id: row.device_id,
    channels_sent: row.channels_sent || [],
    delivery_status: row.delivery_status,
    read: Boolean(row.read_at),
    read_at: row.read_at,
    created_at: row.created_at,
  };
}

class AlertService {
  constructor() {
    this.alerts = getAlertRepository();
    this.prefs = getAlertPreferenceRepository();
    this.vehicles = getVehicleRepository();
    this.users = getUserRepository();
  }

  async getEngineConfig({ masked = false } = {}) {
    const store = getStore();
    const config = await store.getSettings('alertas');
    const result = {
      enabled: config.enabled !== false,
      webhook_secret: config.webhook_secret || '',
      default_channels: VEHICLE_ALERT_CHANNELS,
      whatsapp_vehicle_alerts: false,
      whatsapp_allowed_for: ['cadastro', 'cobranca', 'recuperacao_senha', 'promocao_admin'],
      dedup_minutes: parseInt(config.dedup_minutes || '5', 10),
    };
    if (masked && result.webhook_secret) {
      result.webhook_secret = '********';
    }
    return result;
  }

  async processGpswoxWebhook(payload) {
    const config = await this.getEngineConfig();
    if (!config.enabled) {
      return { processed: false, reason: 'Motor de alertas desativado.' };
    }

    const normalized = normalizeGpswoxPayload(payload);
    if (!normalized.device_id) {
      return { processed: false, reason: 'device_id não informado.' };
    }

    const duplicate = await this.alerts.findRecentDuplicate({
      source: 'gpswox',
      sourceEventId: normalized.source_event_id,
      minutes: config.dedup_minutes,
    });
    if (duplicate) {
      return { processed: true, duplicate: true, alert_id: duplicate.id };
    }

    const vehicle = await this.vehicles.findByDeviceId(normalized.device_id);
    if (!vehicle) {
      return { processed: false, reason: `Veículo não encontrado para device ${normalized.device_id}.` };
    }

    const user = await this.users.findByIdWithProvisioning(vehicle.user_id);
    if (!user || !user.active) {
      return { processed: false, reason: 'Usuário inativo ou não encontrado.' };
    }

    let channels = filterVehicleAlertChannels(
      await this.prefs.resolveChannels(user.id, vehicle.id, normalized.alert_type)
    );

    const pref = await this.prefs.getForAlert(user.id, vehicle.id, normalized.alert_type);
    if (pref && !pref.enabled) {
      return { processed: true, skipped: true, reason: 'Alerta desabilitado pelo usuário.' };
    }

    const event = await this.alerts.create({
      user_id: user.id,
      vehicle_id: vehicle.id,
      alert_type: normalized.alert_type,
      title: normalized.title,
      message: normalized.message,
      source: 'gpswox',
      source_event_id: normalized.source_event_id,
      device_id: normalized.device_id,
      payload: normalized.payload,
      delivery_status: 'sending',
    });

    const channelsSent = await this._dispatch({
      user,
      channels,
      title: normalized.title,
      message: normalized.message,
      alertType: normalized.alert_type,
      vehicleId: vehicle.id,
      eventId: event.id,
    });

    const deliveryStatus = channelsSent.length ? 'delivered' : 'failed';
    await this.alerts.updateDelivery(event.id, {
      channels_sent: channelsSent,
      delivery_status: deliveryStatus,
    });

    return {
      processed: true,
      alert_id: event.id,
      user_id: user.id,
      vehicle_id: vehicle.id,
      channels_sent: channelsSent,
      delivery_status: deliveryStatus,
    };
  }

  async _dispatch({ user, channels, title, message, alertType, vehicleId, eventId }) {
    const sent = [];
    const safeChannels = filterVehicleAlertChannels(channels);

    if (safeChannels.includes('push')) {
      try {
        const result = await firebase.sendPushToUser(user.id, {
          title: `Águia — ${title}`,
          body: message,
          data: { type: 'alert', alert_type: alertType, vehicle_id: String(vehicleId || ''), event_id: String(eventId) },
        });
        if (result.sent > 0) sent.push('push');
      } catch (err) {
        logger.warn('Falha push alerta.', { userId: user.id, err: err.message });
      }
    }

    // WhatsApp bloqueado para alertas de veículo (anti-ban Meta)
    return sent;
  }

  async listForUser(userId, options = {}) {
    const rows = await this.alerts.listByUser(userId, options);
    return rows.map(formatAlert);
  }

  async listAll(options = {}) {
    const rows = await this.alerts.listAll(options);
    return rows.map(row => ({
      ...formatAlert(row),
      user_email: row.user_email,
      user_name: row.user_name,
    }));
  }

  async getUnreadCount(userId) {
    return this.alerts.countUnread(userId);
  }

  async markRead(userId, alertId) {
    const row = await this.alerts.markRead(alertId, userId);
    if (!row) throw new Error('Alerta não encontrado.');
    return formatAlert(row);
  }

  async markAllRead(userId) {
    await this.alerts.markAllRead(userId);
    return { success: true };
  }

  async getPreferences(userId, vehicleId = null) {
    return this.prefs.getEffectivePreferences(userId, vehicleId);
  }

  async updatePreferences(userId, { preferences, vehicle_id }) {
    if (!Array.isArray(preferences)) {
      throw new Error('preferences deve ser um array.');
    }
    const saved = await this.prefs.upsertMany(userId, preferences, vehicle_id || null);
    return saved;
  }

  async sendTestAlert(userId) {
    const user = await this.users.findByIdWithProvisioning(userId);
    if (!user) throw new Error('Usuário não encontrado.');

    const channels = VEHICLE_ALERT_CHANNELS;
    const title = 'Alerta de teste';
    const message = 'Este é um alerta de teste da Águia Gestão Veicular.';

    const event = await this.alerts.create({
      user_id: userId,
      alert_type: 'movimento',
      title,
      message,
      source: 'admin_test',
      delivery_status: 'sending',
    });

    const channelsSent = await this._dispatch({
      user,
      channels,
      title,
      message,
      alertType: 'movimento',
      vehicleId: null,
      eventId: event.id,
    });

    await this.alerts.updateDelivery(event.id, {
      channels_sent: channelsSent,
      delivery_status: channelsSent.length ? 'delivered' : 'failed',
    });

    return { success: channelsSent.length > 0, channels_sent: channelsSent, alert_id: event.id };
  }

  getTypes() {
    return {
      tipos: ALERT_TYPES.map(t => ({ key: t, label: ALERT_TYPE_LABELS[t] || t })),
      canais: VEHICLE_ALERT_CHANNELS,
      whatsapp_policy: {
        vehicle_alerts: false,
        allowed_for: ['Cadastro', 'Cobranças', 'Recuperação de senha', 'Promoções (admin)'],
        reason: 'Evita banimento por excesso de mensagens operacionais (ignição, rota, etc.).',
      },
    };
  }
}

let instance = null;

function getAlertService() {
  if (!instance) instance = new AlertService();
  return instance;
}

module.exports = { AlertService, getAlertService, formatAlert };
