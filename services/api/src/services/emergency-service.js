const { getStore, getDefaults } = require('@aguia/integrations');
const { getUserRepository } = require('../repositories/user-repository');
const { getVehicleRepository } = require('../repositories/vehicle-repository');
const { getEmergencyContactRepository } = require('../repositories/emergency-contact-repository');
const { getEmergencyEventRepository } = require('../repositories/emergency-event-repository');
const firebase = require('./firebase');
const whatsapp = require('./whatsapp');
const sms = require('./sms');
const { normalizePhone } = require('../lib/phone');
const gpswox = require('../integrations/gpswox-gateway');
const { normalizeProviderName } = require('../lib/tracking-platform');
const logger = require('../logger');

const NATIONAL_CONTACTS = {
  policia: { label: 'Polícia', phone: '190' },
  bombeiros: { label: 'Bombeiros', phone: '193' },
  samu: { label: 'SAMU', phone: '192' },
};

async function getEmergencyConfig() {
  const defaults = getDefaults('emergencia');
  try {
    const store = getStore();
    const config = await store.get('emergencia');
    return {
      integrationEnabled: config.enabled !== false,
      ...defaults,
      ...(config.settings || {}),
    };
  } catch {
    return {
      integrationEnabled: false,
      ...defaults,
    };
  }
}

function parsePhoneList(value) {
  if (!value) return [];
  return String(value)
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name || null,
    user_email: row.user_email || null,
    user_phone: row.user_phone || null,
    vehicle_id: row.vehicle_id,
    plate: row.plate || null,
    vehicle_label: [row.brand, row.model, row.plate].filter(Boolean).join(' · ') || null,
    message: row.message,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    channels: row.channels || [],
    notified_count: row.notified_count,
    created_at: row.created_at,
  };
}

function buildMapsLink(latitude, longitude) {
  if (latitude == null || longitude == null) return null;
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

function buildAlertText({
  user,
  vehicle,
  address,
  latitude,
  longitude,
  message,
  mapsLink,
}) {
  const lines = [
    '🆘 EMERGÊNCIA Águia',
    `Cliente: ${user.name || user.email}`,
  ];

  if (user.phone) lines.push(`Tel cliente: ${user.phone}`);
  if (vehicle) {
    lines.push(`Veículo: ${[vehicle.brand, vehicle.model, vehicle.plate].filter(Boolean).join(' · ')}`);
  }
  if (address) lines.push(`Local: ${address}`);
  else if (mapsLink) lines.push(`Mapa: ${mapsLink}`);
  if (message) lines.push(`Mensagem: ${message}`);
  lines.push(`Horário: ${new Date().toLocaleString('pt-BR')}`);

  return lines.join('\n');
}

class EmergencyService {
  constructor() {
    this.users = getUserRepository();
    this.vehicles = getVehicleRepository();
    this.contacts = getEmergencyContactRepository();
    this.events = getEmergencyEventRepository();
  }

  async getOverview(userId) {
    const [config, user, userContacts] = await Promise.all([
      getEmergencyConfig(),
      this.users.findById(userId),
      this.contacts.listByUser(userId),
    ]);

    const companyContacts = [];
    if (config.assistencia_24h_phone) {
      companyContacts.push({
        key: 'assistencia_24h',
        label: config.assistencia_24h_label || 'Assistência 24h',
        phone: config.assistencia_24h_phone,
        dial: config.assistencia_24h_phone,
      });
    }
    if (config.seguradora_phone) {
      companyContacts.push({
        key: 'seguradora',
        label: config.seguradora_label || 'Seguradora',
        phone: config.seguradora_phone,
        dial: config.seguradora_phone,
      });
    }

    return {
      enabled: config.integrationEnabled && config.emergency_enabled !== false,
      cooldown_minutes: Number(config.cooldown_minutes || 5),
      nacional: Object.entries(NATIONAL_CONTACTS).map(([key, item]) => ({
        key,
        label: item.label,
        phone: item.phone,
        dial: item.phone,
      })),
      empresa: companyContacts,
      contatos_pessoais: userContacts.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        dial: row.phone,
      })),
      cliente: {
        name: user?.name || null,
        phone: user?.phone || null,
      },
      notify_whatsapp: config.notify_whatsapp !== false && config.notify_whatsapp !== 'false',
      notify_sms: config.notify_sms !== false && config.notify_sms !== 'false',
    };
  }

  async savePersonalContacts(userId, contacts = []) {
    if (!Array.isArray(contacts)) throw new Error('Lista de contatos inválida.');
    if (contacts.length > 5) throw new Error('Máximo de 5 contatos de emergência.');

    const normalized = contacts
      .map((contact) => ({
        name: String(contact.name || '').trim(),
        phone: String(contact.phone || '').trim(),
      }))
      .filter((contact) => contact.name && contact.phone);

    for (const contact of normalized) {
      const digits = contact.phone.replace(/\D/g, '');
      if (digits.length < 10) {
        throw new Error(`Telefone inválido para ${contact.name}.`);
      }
    }

    const saved = await this.contacts.replaceForUser(userId, normalized);
    return saved.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      dial: row.phone,
    }));
  }

  async _resolveLocation(userId, { vehicleId, latitude, longitude }) {
    let vehicle = null;
    let address = null;
    let lat = latitude != null ? Number(latitude) : null;
    let lng = longitude != null ? Number(longitude) : null;

    if (vehicleId) {
      vehicle = await this.vehicles.findByIdForUser(vehicleId, userId);
      if (!vehicle) throw new Error('Veículo não encontrado.');

      try {
        const location = await gpswox.getLocation({
          device_id: vehicle.tracker_device_id,
          veiculo: vehicle.tracker_name || vehicle.plate,
          provider: normalizeProviderName(vehicle.tracking_provider),
        });
        lat = location.latitude ?? lat;
        lng = location.longitude ?? lng;
        address = location.endereco || location.address || null;
      } catch (err) {
        logger.warn('Emergência: falha ao obter localização GPSWOX.', { vehicleId, err: err.message });
      }
    }

    return { vehicle, latitude: lat, longitude: lng, address };
  }

  async _notifyRecipient(phone, text, config, meta) {
    const normalized = normalizePhone(phone);
    const channels = [];
    const useWhatsApp = config.notify_whatsapp !== false && config.notify_whatsapp !== 'false';
    const useSms = config.notify_sms !== false && config.notify_sms !== 'false';

    if (useWhatsApp) {
      try {
        await whatsapp.sendText({ to: normalized, text }, meta);
        channels.push({ phone: normalized, channel: 'whatsapp', status: 'sent' });
        return channels;
      } catch (waErr) {
        channels.push({ phone: normalized, channel: 'whatsapp', status: 'failed', error: waErr.message });
        if (!useSms) throw waErr;
      }
    }

    if (useSms) {
      const result = await sms.sendText({
        to: normalized,
        text,
        user: meta.user,
        action: meta.action,
      });
      channels.push({
        phone: normalized,
        channel: 'sms',
        status: 'sent',
        provider: result?.provider || null,
      });
    }

    return channels;
  }

  async trigger(userId, payload = {}) {
    const config = await getEmergencyConfig();
    if (!config.integrationEnabled || config.emergency_enabled === false) {
      throw new Error('Botão de emergência desativado. Contate o suporte.');
    }

    const cooldownMinutes = Number(config.cooldown_minutes || 5);
    const latest = await this.events.findLatestForUser(userId);
    if (latest) {
      const elapsedMs = Date.now() - new Date(latest.created_at).getTime();
      if (elapsedMs < cooldownMinutes * 60 * 1000) {
        const waitMin = Math.ceil((cooldownMinutes * 60 * 1000 - elapsedMs) / 60000);
        throw new Error(`Aguarde ${waitMin} minuto(s) antes de acionar novamente.`);
      }
    }

    const user = await this.users.findById(userId);
    if (!user) throw new Error('Usuário não encontrado.');

    const [personalContacts, locationCtx] = await Promise.all([
      this.contacts.listByUser(userId),
      this._resolveLocation(userId, {
        vehicleId: payload.vehicle_id ? Number(payload.vehicle_id) : null,
        latitude: payload.latitude,
        longitude: payload.longitude,
      }),
    ]);

    const { vehicle, latitude, longitude, address } = locationCtx;
    const mapsLink = buildMapsLink(latitude, longitude);
    const alertText = buildAlertText({
      user,
      vehicle,
      address,
      latitude,
      longitude,
      message: payload.message,
      mapsLink,
    });

    const recipients = [];
    for (const contact of personalContacts) {
      recipients.push({ phone: contact.phone, label: contact.name, type: 'personal' });
    }

    for (const phone of parsePhoneList(config.company_alert_phones)) {
      recipients.push({ phone, label: 'Central Águia', type: 'company' });
    }

    if (recipients.length === 0) {
      throw new Error('Cadastre ao menos um contato de emergência em Meu Perfil ou peça ao suporte.');
    }

    const channelResults = [];
    const meta = { user: userId, action: 'emergency.alert' };

    for (const recipient of recipients) {
      try {
        const sent = await this._notifyRecipient(recipient.phone, alertText, config, meta);
        channelResults.push(...sent.map((row) => ({ ...row, recipient: recipient.label, type: recipient.type })));
      } catch (err) {
        channelResults.push({
          phone: recipient.phone,
          recipient: recipient.label,
          type: recipient.type,
          channel: 'sms',
          status: 'failed',
          error: err.message,
        });
      }
    }

    const successCount = channelResults.filter((row) => row.status === 'sent').length;
    if (successCount === 0) {
      throw new Error('Não foi possível notificar nenhum contato. Verifique telefones e integrações WhatsApp/SMS.');
    }

    const event = await this.events.create({
      user_id: userId,
      vehicle_id: vehicle?.id || null,
      message: payload.message || null,
      latitude,
      longitude,
      address,
      channels: channelResults,
      notified_count: successCount,
    });

    try {
      await firebase.sendPushToUser(userId, {
        title: '🆘 Alerta de emergência enviado',
        body: `${successCount} contato(s) notificado(s). Se estiver em perigo, ligue 190.`,
        data: {
          type: 'emergency_sent',
          event_id: String(event.id),
        },
      });
    } catch (err) {
      logger.warn('Emergência: push de confirmação falhou.', { userId, err: err.message });
    }

    return {
      event_id: event.id,
      notified_count: successCount,
      channels: channelResults,
      maps_link: mapsLink,
      message: `Emergência acionada. ${successCount} contato(s) notificado(s).`,
    };
  }

  async listRecentEvents(limit = 20) {
    const rows = await this.events.listRecent({ limit });
    return rows.map(formatEvent);
  }

  async getOperationalStats() {
    const count24h = await this.events.countSince(24);
    const recent = await this.events.listRecent({ limit: 5 });
    return {
      count_24h: count24h,
      recent: recent.map(formatEvent),
    };
  }
}

let instance = null;

function getEmergencyService() {
  if (!instance) instance = new EmergencyService();
  return instance;
}

module.exports = {
  EmergencyService,
  getEmergencyService,
  getEmergencyConfig,
  NATIONAL_CONTACTS,
};
