const { getStore } = require('@aguia/integrations');
const { GpswoxApiClient } = require('../clients/gpswox-api');
const { TraccarApiClient } = require('../clients/traccar-api');

const DEFAULT_PROVIDER = 'gpswox';

async function getRastreamentoConfig() {
  const store = getStore();
  try {
    const config = await store.get('rastreamento');
    return config.settings || {};
  } catch {
    return { provider: DEFAULT_PROVIDER };
  }
}

async function getActiveProviderName() {
  const settings = await getRastreamentoConfig();
  const provider = String(settings.provider || DEFAULT_PROVIDER).toLowerCase();
  return provider === 'traccar' ? 'traccar' : DEFAULT_PROVIDER;
}

async function getGpswoxConfig() {
  const store = getStore();
  return store.getSettings('gpswox');
}

async function getTraccarConfig() {
  const store = getStore();
  return store.getSettings('traccar');
}

async function getGatewayConfig() {
  const store = getStore();
  return store.getSettings('gateway');
}

async function getTrackingClient(provider) {
  const name = provider
    ? (String(provider).toLowerCase() === 'traccar' ? 'traccar' : DEFAULT_PROVIDER)
    : await getActiveProviderName();

  if (name === 'traccar') {
    const settings = await getTraccarConfig();
    return {
      name: 'traccar',
      client: new TraccarApiClient(settings),
      settings,
    };
  }

  const settings = await getGpswoxConfig();
  return {
    name: 'gpswox',
    client: new GpswoxApiClient(settings),
    settings,
  };
}

async function getActiveTrackingClient() {
  return getTrackingClient();
}

function gpswoxOnlyFeature(featureLabel) {
  return `${featureLabel} disponível apenas com GPSWOX ativo. Altere em Integrações → Plataforma de Rastreamento.`;
}

module.exports = {
  DEFAULT_PROVIDER,
  getRastreamentoConfig,
  getActiveProviderName,
  getGpswoxConfig,
  getTraccarConfig,
  getGatewayConfig,
  getActiveTrackingClient,
  getTrackingClient,
  gpswoxOnlyFeature,
};
