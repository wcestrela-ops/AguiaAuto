const { getStore } = require('@aguia/integrations');
const { ALERT_TYPES, ALERT_CHANNELS } = require('@aguia/shared');
const { getAlertRepository } = require('../repositories/alert-repository');
const { getAlertPreferenceRepository, DEFAULT_CHANNELS } = require('../repositories/alert-preference-repository');
const { getVehicleRepository } = require('../repositories/vehicle-repository');
const { getUserRepository } = require('../repositories/user-repository');
const { normalizeGpswoxPayload, ALERT_TYPE_LABELS } = require('../lib/gpswox-events');
const firebase = require('./firebase');
const whatsapp = require('./whatsapp');
const { normalizePhone } = require('../lib/phone');
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
      default_channels: String(config.default_channels || 'push,whatsapp')
        .split(',').map(s => s.trim()).filter(Boolean),
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

    let channels = await this.prefs.resolveChannels(user.id, vehicle.id, normalized.alert_type);
    if (!channels?.length) channels = config.default_channels.length ? config.default_channels : DEFAULT_CHANNELS;

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
    const text = `🚨 ${title}\n${message}`;

    if (channels.includes('push')) {
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

    if (channels.includes('whatsapp') && user.phone) {
      try {
        await whatsapp.sendAlert(normalizePhone(user.phone), text, { user: user.email, alert_type: alertType });
        sent.push('whatsapp');
      } catch (err) {
        logger.warn('Falha WhatsApp alerta.', { userId: user.id, err: err.message });
      }
    }

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

    const channels = DEFAULT_CHANNELS;
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
      canais: ALERT_CHANNELS,
    };
  }
}

let instance = null;

function getAlertService() {
  if (!instance) instance = new AlertService();
  return instance;
}

module.exports = { AlertService, getAlertService, formatAlert };
