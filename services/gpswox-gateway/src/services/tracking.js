const { GpswoxApiClient } = require('../clients/gpswox-api');
const { getGpswoxConfig } = require('../config/provider');
const { getVehicleLocation } = require('../playwright/tracker');
const { enqueue } = require('../queue');
const logger = require('../logger');

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

module.exports = {
  getLocation,
  blockDevice,
  unblockDevice,
  sendCommand,
  createCliente,
  createVeiculo,
  getHistory,
  createSharing,
};
