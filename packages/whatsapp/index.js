const WhatsAppProvider = require('./contracts/WhatsAppProvider');
const { WhatsAppService, getWhatsAppService, SEND_METHODS } = require('./WhatsAppService');
const { createProvider, listSupportedProviders } = require('./provider-factory');
const { WhatsAppRepository, getRepository } = require('./repository');
const {
  PROVIDER_TYPES,
  getProviderSchema,
  listProviderTypes,
  maskProvider,
} = require('./schemas');

module.exports = {
  WhatsAppProvider,
  WhatsAppService,
  getWhatsAppService,
  SEND_METHODS,
  createProvider,
  listSupportedProviders,
  WhatsAppRepository,
  getRepository,
  PROVIDER_TYPES,
  getProviderSchema,
  listProviderTypes,
  maskProvider,
};
