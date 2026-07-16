const gpswox = require('../integrations/gpswox-gateway');
const { getTrackerModelRepository } = require('../repositories/tracker-model-repository');
const { getVehicleRepository } = require('../repositories/vehicle-repository');
const { getUserRepository } = require('../repositories/user-repository');
const { getAuditService } = require('./audit-service');
const logger = require('../logger');

function extractSimNumber(device) {
  return (
    device.sim_number
    || device.sim
    || device.phone
    || device.sim_phone
    || device.msisdn
    || device.tracker_phone
    || null
  );
}

function extractTrackerModel(device) {
  return device.device_model || device.model || device.tracker_model || device.protocol || null;
}

function extractImei(device) {
  return device.imei || device.uniqueId || device.unique_id || null;
}

function extractPlate(device) {
  return device.plate || device.registration_number || device.license_plate || null;
}

function normalizeDevicesResponse(data) {
  const items = data?.items || data?.devices || data?.data || data || [];
  return Array.isArray(items) ? items : Object.values(items);
}

class GpswoxSyncService {
  constructor() {
    this.vehicles = getVehicleRepository();
    this.users = getUserRepository();
    this.trackerModels = getTrackerModelRepository();
  }

  async _resolveTrackerModelId(modelName) {
    if (!modelName) return null;
    const byName = await this.trackerModels.findModelByName(modelName);
    if (byName) return byName.id;
    const models = await this.trackerModels.listModels();
    const lower = modelName.toLowerCase();
    const match = models.find(
      (m) => m.protocol && lower.includes(String(m.protocol).toLowerCase()),
    );
    return match?.id || null;
  }

  async importDevices({ dryRun = false, defaultUserId } = {}) {
    const response = await gpswox.listDevices();
    const devices = normalizeDevicesResponse(response?.data || response);

    const summary = {
      total: devices.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      preview: [],
    };

    for (const device of devices) {
      try {
        const deviceId = device.id != null ? String(device.id) : null;
        if (!deviceId) {
          summary.skipped += 1;
          continue;
        }

        const gpswoxUserId = device.user_id || device.client_id || device.userId || null;
        let userId = defaultUserId || null;

        if (gpswoxUserId) {
          const user = await this.users.findByGpswoxUserId(String(gpswoxUserId));
          if (user) userId = user.id;
        }

        const modelName = extractTrackerModel(device);
        const trackerModelId = await this._resolveTrackerModelId(modelName);

        const payload = {
          gpswox_device_id: deviceId,
          gpswox_name: device.name || device.title || `Dispositivo ${deviceId}`,
          tracker_phone: extractSimNumber(device),
          tracker_model: modelName,
          tracker_model_id: trackerModelId,
          tracker_imei: extractImei(device),
          plate: extractPlate(device),
          gpswox_synced_at: new Date().toISOString(),
        };

        const existing = await this.vehicles.findByDeviceId(deviceId);

        if (dryRun) {
          summary.preview.push({
            device_id: deviceId,
            action: existing ? 'update' : userId ? 'create' : 'skip_no_user',
            ...payload,
            user_id: userId,
            customer_name: device.user_name || device.client_name || device.owner || null,
          });
          continue;
        }

        if (existing) {
          await this.vehicles.update(existing.id, payload);
          summary.updated += 1;
          continue;
        }

        if (!userId) {
          summary.skipped += 1;
          summary.errors.push({
            device_id: deviceId,
            reason: 'Cliente Águia não encontrado para user_id GPSWOX',
            gpswox_user_id: gpswoxUserId,
          });
          continue;
        }

        await this.vehicles.create({
          user_id: userId,
          plate: payload.plate || payload.gpswox_name.slice(0, 10).toUpperCase(),
          brand: device.brand || null,
          model: device.vehicle_model || device.model || null,
          status: 'active',
          ...payload,
        });
        summary.created += 1;
      } catch (err) {
        summary.errors.push({
          device_id: device?.id,
          reason: err.message,
        });
      }
    }

    logger.info('Importação GPSWOX concluída', summary);
    return summary;
  }

  async syncAndAudit(options = {}, req) {
    const summary = await this.importDevices(options);
    await getAuditService().adminAction('gpswox.sync', {
      resourceType: 'vehicle',
      metadata: {
        dry_run: Boolean(options.dryRun),
        created: summary.created,
        updated: summary.updated,
        skipped: summary.skipped,
        total: summary.total,
      },
      req,
    });
    return summary;
  }
}

let instance = null;

function getGpswoxSyncService() {
  if (!instance) instance = new GpswoxSyncService();
  return instance;
}

module.exports = { GpswoxSyncService, getGpswoxSyncService };
