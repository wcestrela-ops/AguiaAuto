const gpswox = require('../integrations/gpswox-gateway');
const { getActiveSyncSettings, getProviderLabel } = require('../lib/tracking-platform');
const { getTrackerModelRepository } = require('../repositories/tracker-model-repository');
const { getVehicleRepository } = require('../repositories/vehicle-repository');
const { getUserRepository } = require('../repositories/user-repository');
const { getGpswoxSyncRunRepository } = require('../repositories/gpswox-sync-run-repository');
const { getAuditService } = require('./audit-service');
const logger = require('../logger');

let syncInProgress = false;

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

async function getSyncSettings() {
  return getActiveSyncSettings();
}

function computeNextDueAt(lastRun, intervalHours) {
  if (!lastRun?.finished_at) return null;
  const due = new Date(lastRun.finished_at).getTime() + intervalHours * 60 * 60 * 1000;
  return new Date(due).toISOString();
}

function isSyncDue(lastRun, intervalHours) {
  if (!lastRun?.finished_at) return true;
  const dueAt = new Date(lastRun.finished_at).getTime() + intervalHours * 60 * 60 * 1000;
  return Date.now() >= dueAt;
}

class GpswoxSyncService {
  constructor() {
    this.vehicles = getVehicleRepository();
    this.users = getUserRepository();
    this.trackerModels = getTrackerModelRepository();
    this.runs = getGpswoxSyncRunRepository();
  }

  async getStatus() {
    const settings = await getSyncSettings();
    const lastRun = await this.runs.getLastRun();
    const lastSuccess = await this.runs.getLastRun({ successOnly: true });
    const recent = await this.runs.listRecent(5);
    const unlinked = lastSuccess ? await this.runs.countUnlinkedFromLastRun() : 0;

    return {
      provider: settings.provider,
      provider_label: settings.providerLabel,
      auto_sync_enabled: settings.enabled,
      interval_hours: settings.intervalHours,
      in_progress: syncInProgress,
      last_run: lastRun,
      last_success: lastSuccess,
      next_due_at: settings.enabled ? computeNextDueAt(lastSuccess, settings.intervalHours) : null,
      due_now: settings.enabled && isSyncDue(lastSuccess, settings.intervalHours),
      unlinked_devices_last_success: unlinked,
      recent_runs: recent,
    };
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

  async _resolveUserId(device, defaultUserId) {
    const platformUserId = device.user_id || device.client_id || device.userId || null;
    const aguiaUserId = device.attributes?.aguia_user_id || device.aguia_user_id || null;

    if (aguiaUserId) {
      const user = await this.users.findById(String(aguiaUserId));
      if (user) return user.id;
    }

    if (platformUserId) {
      const user = await this.users.findByGpswoxUserId(String(platformUserId));
      if (user) return user.id;
    }

    return defaultUserId || null;
  }

  async importDevices({ dryRun = false, defaultUserId } = {}) {
    const settings = await getSyncSettings();
    const providerLabel = getProviderLabel(settings.provider);
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

        const platformUserId = device.user_id || device.client_id || device.userId || null;
        const userId = await this._resolveUserId(device, defaultUserId);

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
            reason: `Cliente Águia não encontrado para dispositivo ${providerLabel}`,
            platform_user_id: platformUserId,
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

    logger.info(`Importação ${providerLabel} concluída`, summary);
    return summary;
  }

  async _runWithLog({ triggeredBy, dryRun, defaultUserId, req } = {}) {
    const run = await this.runs.startRun({ triggered_by: triggeredBy, dry_run: dryRun });

    try {
      const summary = await this.importDevices({ dryRun, defaultUserId });
      await this.runs.finishRun(run.id, { summary, success: true });

      if (!dryRun && req) {
        await getAuditService().adminAction('gpswox.sync', {
          resourceType: 'vehicle',
          metadata: {
            triggered_by: triggeredBy,
            created: summary.created,
            updated: summary.updated,
            skipped: summary.skipped,
            total: summary.total,
          },
          req,
        });
      }

      return { ...summary, run_id: run.id };
    } catch (err) {
      await this.runs.finishRun(run.id, {
        summary: { total: 0, created: 0, updated: 0, skipped: 0, errors: [] },
        success: false,
        error_message: err.message,
      });
      throw err;
    }
  }

  async syncAndAudit(options = {}, req) {
    return this._runWithLog({
      triggeredBy: 'admin',
      dryRun: Boolean(options.dryRun),
      defaultUserId: options.defaultUserId,
      req,
    });
  }

  async runScheduledSync() {
    if (syncInProgress) {
      logger.info('Sync de plataforma agendado ignorado — execução já em andamento.');
      return null;
    }

    const settings = await getSyncSettings();
    if (!settings.enabled) {
      return null;
    }

    const lastSuccess = await this.runs.getLastRun({ successOnly: true });
    if (!isSyncDue(lastSuccess, settings.intervalHours)) {
      return null;
    }

    syncInProgress = true;
    try {
      const providerLabel = getProviderLabel(settings.provider);
      logger.info(`Iniciando sync ${providerLabel} agendado.`);
      const summary = await this._runWithLog({ triggeredBy: 'scheduler', dryRun: false });
      logger.info(`Sync ${providerLabel} agendado concluído.`, {
        created: summary.created,
        updated: summary.updated,
        skipped: summary.skipped,
      });
      return summary;
    } finally {
      syncInProgress = false;
    }
  }
}

let instance = null;

function getGpswoxSyncService() {
  if (!instance) instance = new GpswoxSyncService();
  return instance;
}

function startGpswoxSyncPoller(checkIntervalMs) {
  const intervalMs = checkIntervalMs
    || parseInt(process.env.GPSWOX_SYNC_CHECK_MS || '900000', 10);

  const run = async () => {
    try {
      await getGpswoxSyncService().runScheduledSync();
    } catch (err) {
      logger.warn('Poller sync de plataforma falhou.', { err: err.message });
    }
  };

  run();
  return setInterval(run, intervalMs);
}

module.exports = {
  GpswoxSyncService,
  getGpswoxSyncService,
  startGpswoxSyncPoller,
  getSyncSettings,
};
