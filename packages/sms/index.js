const SmsProvider = require('./contracts/SmsProvider');
const { SmsService, getSmsService } = require('./SmsService');
const { createProvider, listSupportedProviders } = require('./provider-factory');
const { SmsRepository, getRepository } = require('./repository');
const {
  PROVIDER_TYPES,
  getProviderSchema,
  listProviderTypes,
  maskProvider,
} = require('./schemas');
const { applyGatewayTemplate, normalizePhoneDigits } = require('./lib/gateway-template');

module.exports = {
  SmsProvider,
  SmsService,
  getSmsService,
  createProvider,
  listSupportedProviders,
  SmsRepository,
  getRepository,
  PROVIDER_TYPES,
  getProviderSchema,
  listProviderTypes,
  maskProvider,
  applyGatewayTemplate,
  normalizePhoneDigits,
};
