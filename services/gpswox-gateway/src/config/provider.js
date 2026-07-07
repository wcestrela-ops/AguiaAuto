const { getStore } = require('@aguia/integrations');

async function getGpswoxConfig() {
  const store = getStore();
  return store.getSettings('gpswox');
}

async function getGatewayConfig() {
  const store = getStore();
  return store.getSettings('gateway');
}

module.exports = { getGpswoxConfig, getGatewayConfig };
