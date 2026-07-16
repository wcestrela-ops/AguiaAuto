const FakeProvider = require('./providers/FakeProvider');
const AndroidProvider = require('./providers/AndroidProvider');
const SmsMarketProvider = require('./providers/SmsMarketProvider');

const PROVIDERS = {
  fake: FakeProvider,
  android: AndroidProvider,
  smsmarket: SmsMarketProvider,
};

function createProvider(config) {
  const Provider = PROVIDERS[config.provider];
  if (!Provider) {
    throw new Error(`Provedor SMS "${config.provider}" não suportado.`);
  }
  return new Provider(config);
}

function listSupportedProviders() {
  return Object.keys(PROVIDERS);
}

module.exports = { createProvider, listSupportedProviders };
