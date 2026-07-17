const { getExternalEntityMappingRepository } = require('../repositories/external-entity-mapping-repository');
const { getTenantTrackingConfigRepository } = require('../repositories/tenant-tracking-config-repository');
const { normalizeProviderName } = require('../lib/tracking-platform');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

class ExternalEntityMappingService {
  constructor() {
    this.mappings = getExternalEntityMappingRepository();
    this.configs = getTenantTrackingConfigRepository();
  }

  async linkEntity(tenantId, provider, entityType, internalId, externalId, options = {}) {
    if (!externalId) return null;
    const config = await this.configs.get(tenantId);
    return this.mappings.upsert({
      tenant_id: tenantId,
      provider: normalizeProviderName(provider),
      entity_type: entityType,
      internal_id: internalId,
      external_id: String(externalId),
      sync_strategy: options.sync_strategy || config.sync_strategy,
      metadata: options.metadata || {},
    });
  }

  async linkUser(tenantId, userId, provider, externalId, options = {}) {
    return this.linkEntity(tenantId, provider, 'user', userId, externalId, options);
  }

  async linkVehicle(tenantId, vehicleId, provider, externalId, options = {}) {
    return this.linkEntity(tenantId, provider, 'vehicle', vehicleId, externalId, options);
  }

  async resolveExternalId(tenantId, provider, entityType, internalId, fallback = null) {
    const mapped = await this.mappings.findExternalId(
      tenantId,
      normalizeProviderName(provider),
      entityType,
      internalId,
    );
    return mapped || fallback;
  }

  async resolveVehicleDeviceId(tenantId, vehicle) {
    const provider = normalizeProviderName(vehicle.tracking_provider || 'gpswox');
    return this.resolveExternalId(
      tenantId || vehicle.tenant_id || DEFAULT_TENANT_ID,
      provider,
      'vehicle',
      vehicle.id,
      vehicle.tracker_device_id,
    );
  }

  async resolveUserPlatformId(tenantId, user, provider) {
    const name = normalizeProviderName(provider);
    const fallback = name === 'traccar' ? user.traccar_user_id : user.gpswox_user_id;
    return this.resolveExternalId(tenantId || user.tenant_id || DEFAULT_TENANT_ID, name, 'user', user.id, fallback);
  }

  async findInternalByExternal(tenantId, provider, entityType, externalId) {
    return this.mappings.findInternalId(
      tenantId,
      normalizeProviderName(provider),
      entityType,
      externalId,
    );
  }

  async listForTenant(tenantId, filters = {}) {
    return this.mappings.listByTenant(tenantId, filters);
  }

  async getTrackingConfig(tenantId) {
    return this.configs.get(tenantId);
  }

  async updateTrackingConfig(tenantId, data) {
    return this.configs.upsert(tenantId, data);
  }
}

let instance = null;

function getExternalEntityMappingService() {
  if (!instance) instance = new ExternalEntityMappingService();
  return instance;
}

module.exports = { ExternalEntityMappingService, getExternalEntityMappingService };
