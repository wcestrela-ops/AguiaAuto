const { getStore } = require('@aguia/integrations');

async function getGatewayClientConfig() {
  const store = getStore();
  return store.getSettings('gateway_client');
}

async function gatewayRequest(path, options = {}) {
  const config = await getGatewayClientConfig();

  const response = await fetch(`${config.url.replace(/\/$/, '')}${path}`, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.secret ? { Authorization: `Bearer ${config.secret}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Erro no gateway (${response.status})`);
  }

  return data;
}

module.exports = {
  getLocation: (payload) => gatewayRequest('/localizacao', { body: payload }),
  createCliente: (payload) => gatewayRequest('/clientes', { body: payload }),
  createVeiculo: (payload) => gatewayRequest('/veiculos', { body: payload }),
  blockDevice: (deviceId) => gatewayRequest('/bloqueio', { body: { device_id: deviceId } }),
  unblockDevice: (deviceId) => gatewayRequest('/desbloqueio', { body: { device_id: deviceId } }),
  sendCommand: (deviceId, comando) => gatewayRequest('/comandos', { body: { device_id: deviceId, comando } }),
  getHistory: (deviceId, from, to) => gatewayRequest('/historico', {
    body: { device_id: deviceId, from, to },
  }),
  createSharing: (deviceId, durationMinutes) => gatewayRequest('/compartilhar', {
    body: { device_id: deviceId, duration_minutes: durationMinutes },
  }),
  listDevices: () => gatewayRequest('/dispositivos', { body: {} }),
};
