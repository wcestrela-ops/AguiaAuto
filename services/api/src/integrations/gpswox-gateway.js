const { getStore } = require('@aguia/integrations');

async function getGatewayClientConfig() {
  const store = getStore();
  return store.getSettings('gateway_client');
}

function withProvider(body, provider) {
  if (!provider) return body;
  return { ...body, provider };
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
  blockDevice: (deviceId, provider) => gatewayRequest('/bloqueio', {
    body: withProvider({ device_id: deviceId }, provider),
  }),
  unblockDevice: (deviceId, provider) => gatewayRequest('/desbloqueio', {
    body: withProvider({ device_id: deviceId }, provider),
  }),
  sendCommand: (deviceId, comando, provider) => gatewayRequest('/comandos', {
    body: withProvider({ device_id: deviceId, comando }, provider),
  }),
  getHistory: (deviceId, from, to, provider) => gatewayRequest('/historico', {
    body: withProvider({ device_id: deviceId, from, to }, provider),
  }),
  createSharing: (deviceId, durationMinutes, provider) => gatewayRequest('/compartilhar', {
    body: withProvider({ device_id: deviceId, duration_minutes: durationMinutes }, provider),
  }),
  listDevices: (provider) => gatewayRequest('/dispositivos', {
    body: withProvider({}, provider),
  }),
  listSmsTemplates: (lang = 'en') => gatewayRequest('/sms-templates/list', { body: { lang } }),
  createSmsTemplate: (payload) => gatewayRequest('/sms-templates', { body: payload }),
  updateSmsTemplate: (id, payload) => gatewayRequest(`/sms-templates/${id}`, {
    method: 'PUT',
    body: payload,
  }),
  getSmsTemplateMessage: (id, lang = 'en') => gatewayRequest(`/sms-templates/${id}/message`, {
    body: { lang },
  }),
  manageGeofence: (payload) => gatewayRequest('/cerca', { body: payload }),
  getDeviceEvents: (payload) => gatewayRequest('/eventos', { body: payload }),
  deleteDeviceEvents: (deviceId, filters = {}) => gatewayRequest('/eventos', {
    body: { action: 'delete', device_id: deviceId, filters },
  }),
};
