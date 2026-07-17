const { getTrackingProviderFactory } = require('../lib/tracking/tracking-provider-factory');
const { getExternalEntityMappingService } = require('./external-entity-mapping-service');
const { normalizeProviderName } = require('../lib/tracking-platform');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

class TrackingService {
  constructor() {
    this.factory = getTrackingProviderFactory();
    this.mappings = getExternalEntityMappingService();
  }

  async getProvider(tenantId = DEFAULT_TENANT_ID, providerOverride = null) {
    return this.factory.resolve(tenantId, providerOverride);
  }

  async getVehicleDeviceId(vehicle) {
    return this.mappings.resolveVehicleDeviceId(vehicle.tenant_id || DEFAULT_TENANT_ID, vehicle);
  }

  async getLocation(vehicle, options = {}) {
    const tenantId = vehicle.tenant_id || DEFAULT_TENANT_ID;
    const provider = await this.getProvider(tenantId, vehicle.tracking_provider);
    const deviceId = await this.getVehicleDeviceId(vehicle);
    if (!deviceId) {
      const err = new Error('Veículo sem device ID do rastreador configurado.');
      err.code = 'TRACKING_DEVICE_MISSING';
      throw err;
    }
    return provider.getLocation(deviceId, options);
  }

  async blockDevice(vehicle) {
    const tenantId = vehicle.tenant_id || DEFAULT_TENANT_ID;
    const provider = await this.getProvider(tenantId, vehicle.tracking_provider);
    const deviceId = await this.getVehicleDeviceId(vehicle);
    return provider.blockDevice(deviceId);
  }

  async unblockDevice(vehicle) {
    const tenantId = vehicle.tenant_id || DEFAULT_TENANT_ID;
    const provider = await this.getProvider(tenantId, vehicle.tracking_provider);
    const deviceId = await this.getVehicleDeviceId(vehicle);
    return provider.unblockDevice(deviceId);
  }

  async sendCommand(vehicle, command) {
    const tenantId = vehicle.tenant_id || DEFAULT_TENANT_ID;
    const provider = await this.getProvider(tenantId, vehicle.tracking_provider);
    const deviceId = await this.getVehicleDeviceId(vehicle);
    return provider.sendCommand(deviceId, command);
  }

  async getHistory(vehicle, from, to) {
    const tenantId = vehicle.tenant_id || DEFAULT_TENANT_ID;
    const provider = await this.getProvider(tenantId, vehicle.tracking_provider);
    const deviceId = await this.getVehicleDeviceId(vehicle);
    return provider.getHistory(deviceId, from, to);
  }

  async createSharing(vehicle, durationMinutes = 60) {
    const tenantId = vehicle.tenant_id || DEFAULT_TENANT_ID;
    const provider = await this.getProvider(tenantId, vehicle.tracking_provider);
    const deviceId = await this.getVehicleDeviceId(vehicle);
    return provider.createSharing(deviceId, durationMinutes);
  }

  async createPlatformUser(tenantId, user, provider, payload) {
    const trackingProvider = await this.getProvider(tenantId, provider);
    const result = await trackingProvider.createUser(payload);
    const externalId = extractExternalId(result, ['id', 'user_id']);
    if (externalId) {
      await this.mappings.linkUser(tenantId, user.id, trackingProvider.getProviderName(), externalId);
    }
    return { result, externalId };
  }

  async listDevices(tenantId, provider) {
    const trackingProvider = await this.getProvider(tenantId, provider);
    return trackingProvider.listDevices();
  }

  async linkSyncedVehicle(tenantId, vehicle, provider, externalId) {
    return this.mappings.linkVehicle(
      tenantId,
      vehicle.id,
      normalizeProviderName(provider),
      externalId,
    );
  }
}

function extractExternalId(response, keys = ['id']) {
  if (!response) return null;
  const data = response.data || response;
  for (const key of keys) {
    if (data?.[key] != null) return String(data[key]);
    if (response?.[key] != null) return String(response[key]);
  }
  return null;
}

let instance = null;

function getTrackingService() {
  if (!instance) instance = new TrackingService();
  return instance;
}

module.exports = { TrackingService, getTrackingService, extractExternalId };
