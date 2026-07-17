const { GatewayTrackingProvider } = require('./gateway-tracking-provider');
const { getTenantTrackingConfigRepository } = require('../../repositories/tenant-tracking-config-repository');
const { normalizeProviderName, getDefaultProviderName } = require('../tracking-platform');
const { DEFAULT_TENANT_ID } = require('../tenant/tenant-config');

const PROVIDER_REGISTRY = {
  gpswox: GatewayTrackingProvider,
  traccar: GatewayTrackingProvider,
};

class TrackingProviderFactory {
  get configs() {
    if (!this._configs) {
      this._configs = getTenantTrackingConfigRepository();
    }
    return this._configs;
  }

  createProvider(providerName, { syncStrategy, tenantId } = {}) {
    const name = normalizeProviderName(providerName);
    const ProviderClass = PROVIDER_REGISTRY[name] || GatewayTrackingProvider;
    return new ProviderClass({
      name,
      syncStrategy,
      tenantId,
    });
  }

  async resolve(tenantId = DEFAULT_TENANT_ID, providerOverride = null) {
    const config = await this.configs.get(tenantId);
    let providerName = providerOverride || config.default_provider;

    if (!providerOverride) {
      try {
        providerName = providerName || await getDefaultProviderName();
      } catch {
        providerName = providerName || 'gpswox';
      }
    }

    return this.createProvider(providerName, {
      syncStrategy: config.sync_strategy,
      tenantId,
    });
  }

  async resolveAll(tenantId = DEFAULT_TENANT_ID) {
    const config = await this.configs.get(tenantId);
    return ['gpswox', 'traccar'].map((name) => this.createProvider(name, {
      syncStrategy: config.sync_strategy,
      tenantId,
    }));
  }
}

let instance = null;

function getTrackingProviderFactory() {
  if (!instance) instance = new TrackingProviderFactory();
  return instance;
}

module.exports = { TrackingProviderFactory, getTrackingProviderFactory, PROVIDER_REGISTRY };
