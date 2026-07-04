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

module.exports = {
  getLocation,
  blockDevice,
  unblockDevice,
  sendCommand,
  createCliente,
  createVeiculo,
};
