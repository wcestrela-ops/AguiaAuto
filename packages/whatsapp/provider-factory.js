const EvolutionProvider = require('./providers/EvolutionProvider');
const WahaProvider = require('./providers/WahaProvider');
const MetaCloudProvider = require('./providers/MetaCloudProvider');

const PROVIDERS = {
  evolution: EvolutionProvider,
  waha: WahaProvider,
  meta_cloud: MetaCloudProvider,
};

function createProvider(config) {
  const ProviderClass = PROVIDERS[config.provider];
  if (!ProviderClass) {
    throw new Error(`Provedor WhatsApp "${config.provider}" não suportado.`);
  }
  return new ProviderClass(config);
}

function listSupportedProviders() {
  return Object.keys(PROVIDERS);
}

module.exports = { createProvider, listSupportedProviders };
