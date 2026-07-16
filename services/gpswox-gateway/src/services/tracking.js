const { GpswoxApiClient } = require('../clients/gpswox-api');
const { getGpswoxConfig } = require('../config/provider');
const { getVehicleLocation } = require('../playwright/tracker');
const { enqueue } = require('../queue');
const logger = require('../logger');
const {
  circleToCoordinates,
  formatCoordinatesForGpswox,
  extractGeofenceItems,
  extractEventItems,
} = require('../lib/geofence');

async function getApiClient() {
  const settings = await getGpswoxConfig();
  return new GpswoxApiClient(settings);
}

async function getLocation({ deviceId, veiculo }) {
  const api = await getApiClient();

  if (deviceId && api.enabled) {
    try {
      return await api.getDeviceLocation(deviceId);
    } catch (err) {
      logger.warn('API oficial falhou, usando Playwright.', { deviceId, err: err.message });
    }
  }

  if (!veiculo) {
    throw new Error('Informe deviceId ou veiculo.');
  }

  return enqueue(() => getVehicleLocation(veiculo));
}

async function blockDevice(deviceId) {
  const api = await getApiClient();
  if (!api.enabled) throw new Error('Bloqueio requer api_hash configurado no painel admin.');
  return api.blockDevice(deviceId);
}

async function unblockDevice(deviceId) {
  const api = await getApiClient();
  if (!api.enabled) throw new Error('Desbloqueio requer api_hash configurado no painel admin.');
  return api.unblockDevice(deviceId);
}

async function sendCommand(deviceId, command) {
  const api = await getApiClient();
  if (!api.enabled) throw new Error('Comandos requerem api_hash configurado no painel admin.');
  return api.sendCommand(deviceId, command);
}

async function createCliente(payload) {
  const api = await getApiClient();
  if (!api.enabled) throw new Error('Criação de cliente requer api_hash configurado no painel admin.');
  return api.createUser(payload);
}

async function createVeiculo(payload) {
  const api = await getApiClient();
  if (!api.enabled) throw new Error('Criação de veículo requer api_hash configurado no painel admin.');
  return api.createDevice(payload);
}

function extractSharingUrl(response, baseUrl) {
  const item = response?.data || response?.item || response;
  const direct = item?.url || item?.link || item?.sharing_url;
  if (direct) return direct.startsWith('http') ? direct : `${baseUrl.replace(/\/$/, '')}${direct}`;

  const hash = item?.hash || item?.token || item?.sharing_hash;
  if (hash) return `${baseUrl.replace(/\/$/, '')}/sharing/${hash}`;

  const id = item?.id;
  if (id) return `${baseUrl.replace(/\/$/, '')}/sharing/${id}`;
  return null;
}

async function getHistory(deviceId, from, to) {
  const api = await getApiClient();
  if (!api.enabled) throw new Error('Histórico requer api_hash configurado no painel admin.');
  const data = await api.getHistory(deviceId, from, to);
  const items = data?.items || data?.data || data?.history || data || [];
  const points = (Array.isArray(items) ? items : Object.values(items)).map((point) => ({
    latitude: parseFloat(point.lat ?? point.latitude),
    longitude: parseFloat(point.lng ?? point.longitude),
    time: point.time || point.server_time || point.device_time || point.timestamp || null,
    speed: point.speed ?? null,
    address: point.address || point.endereco || null,
  })).filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));

  return {
    device_id: deviceId,
    from,
    to,
    total: points.length,
    points,
    raw: data,
  };
}

async function createSharing(deviceId, { durationMinutes = 60 } = {}) {
  const api = await getApiClient();
  if (!api.enabled) throw new Error('Compartilhamento requer api_hash configurado no painel admin.');

  const settings = await getGpswoxConfig();
  const response = await api.createSharing({
    deviceId,
    durationMinutes,
    deleteAfterExpiration: true,
  });

  const url = extractSharingUrl(response, settings.url);
  if (!url) {
    throw new Error('GPSWOX não retornou link de compartilhamento.');
  }

  return {
    url,
    duration_minutes: durationMinutes,
    expires_at: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
    raw: response,
  };
}

async function listDevices() {
  const api = await getApiClient();
  if (!api.enabled) throw new Error('Listagem requer api_hash configurado no painel admin.');
  return api.getDevices();
}

async function listSmsTemplates(lang = 'en') {
  const api = await getApiClient();
  if (!api.enabled) throw new Error('Templates SMS requerem api_hash configurado no painel admin.');
  return api.getUserSmsTemplates(lang);
}

async function createSmsTemplate(payload) {
  const api = await getApiClient();
  if (!api.enabled) throw new Error('Templates SMS requerem api_hash configurado no painel admin.');
  return api.addUserSmsTemplate(payload);
}

async function updateSmsTemplate(payload) {
  const api = await getApiClient();
  if (!api.enabled) throw new Error('Templates SMS requerem api_hash configurado no painel admin.');
  return api.editUserSmsTemplate(payload);
}

async function getSmsTemplateMessage(templateId, lang = 'en') {
  const api = await getApiClient();
  if (!api.enabled) throw new Error('Templates SMS requerem api_hash configurado no painel admin.');
  return api.getUserSmsTemplateMessage(templateId, lang);
}

async function manageGeofence(payload = {}) {
  const api = await getApiClient();
  if (!api.enabled) throw new Error('Cercas requerem api_hash configurado no painel admin.');

  const action = String(payload.action || 'list').toLowerCase();

  if (action === 'list') {
    const response = await api.getGeofences(payload.filters || {});
    return { geofences: extractGeofenceItems(response), raw: response };
  }

  if (action === 'groups') {
    const response = await api.getGeofenceGroups(payload.filters || {});
    return { groups: response?.items || response, raw: response };
  }

  if (action === 'create' || action === 'create_circle') {
    const name = payload.name?.trim();
    if (!name) throw new Error('name é obrigatório para criar cerca.');

    let coordinates = payload.coordinates;
    if (action === 'create_circle') {
      coordinates = circleToCoordinates(payload.latitude, payload.longitude, payload.radius_meters);
    }

    const body = {
      name,
      coordinates: formatCoordinatesForGpswox(coordinates),
      polygon_color: payload.polygon_color || payload.color || '#2563eb',
      group_id: payload.group_id ?? 0,
    };

    const response = await api.addGeofence(body);
    return { geofence: response?.data || response, raw: response };
  }

  if (action === 'update') {
    const geofenceId = payload.geofence_id ?? payload.id;
    if (!geofenceId) throw new Error('geofence_id é obrigatório para atualizar cerca.');

    const body = {};
    if (payload.name) body.name = payload.name;
    if (payload.polygon_color || payload.color) body.polygon_color = payload.polygon_color || payload.color;
    if (payload.group_id != null) body.group_id = payload.group_id;
    if (payload.coordinates) body.coordinates = formatCoordinatesForGpswox(payload.coordinates);

    const response = await api.editGeofence(geofenceId, body);
    return { geofence: response?.data || response, raw: response };
  }

  if (action === 'delete') {
    const geofenceId = payload.geofence_id ?? payload.id;
    if (!geofenceId) throw new Error('geofence_id é obrigatório para excluir cerca.');
    const response = await api.destroyGeofence(geofenceId);
    return { deleted: true, geofence_id: geofenceId, raw: response };
  }

  if (action === 'toggle') {
    const geofenceId = payload.geofence_id ?? payload.id;
    if (!geofenceId) throw new Error('geofence_id é obrigatório para alternar cerca.');
    const response = await api.changeActiveGeofence(geofenceId);
    return { geofence_id: geofenceId, raw: response };
  }

  if (action === 'point_in') {
    const lat = parseFloat(payload.latitude);
    const lng = parseFloat(payload.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error('latitude e longitude são obrigatórios para point_in.');
    }
    const response = await api.pointInGeofences(lat, lng, payload.filters || {});
    return { matches: response?.items || response, raw: response };
  }

  throw new Error(`Ação de cerca inválida: ${action}`);
}

async function manageEvents(payload = {}) {
  const api = await getApiClient();
  if (!api.enabled) throw new Error('Eventos requerem api_hash configurado no painel admin.');

  const action = String(payload.action || 'list').toLowerCase();
  const deviceId = payload.device_id ?? payload.deviceId;
  if (!deviceId) throw new Error('device_id é obrigatório.');

  if (action === 'list') {
    const query = {
      device_id: deviceId,
      ...(payload.from ? { from: payload.from } : {}),
      ...(payload.to ? { to: payload.to } : {}),
      ...(payload.filters || {}),
    };
    const response = await api.getEvents(query);
    const events = extractEventItems(response);
    return {
      device_id: deviceId,
      from: payload.from || null,
      to: payload.to || null,
      total: events.length,
      events,
      raw: response,
    };
  }

  if (action === 'delete') {
    const response = await api.destroyEvents(deviceId, payload.filters || {});
    return { device_id: deviceId, deleted: true, raw: response };
  }

  throw new Error(`Ação de eventos inválida: ${action}`);
}

module.exports = {
  getLocation,
  blockDevice,
  unblockDevice,
  sendCommand,
  createCliente,
  createVeiculo,
  getHistory,
  createSharing,
  listDevices,
  listSmsTemplates,
  createSmsTemplate,
  updateSmsTemplate,
  getSmsTemplateMessage,
  manageGeofence,
  manageEvents,
};
