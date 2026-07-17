const { getAllSyncSettings, getSyncSettingsForProvider, getProviderLabel, TRACKING_PROVIDERS, normalizeProviderName } = require('../lib/tracking-platform');
const { getTrackingService } = require('./tracking-service');
const { getExternalEntityMappingService } = require('./external-entity-mapping-service');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
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

async function getSyncSettings(provider) {
  if (provider) return getSyncSettingsForProvider(provider);
  return getAllSyncSettings();
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
    const platforms = await getAllSyncSettings();
    const lastRun = await this.runs.getLastRun();
    const recent = await this.runs.listRecent(10);

    const perPlatform = {};
    for (const settings of platforms) {
      const lastSuccess = await this.runs.getLastRun({ successOnly: true, provider: settings.provider });
      const unlinked = lastSuccess ? await this.runs.countUnlinkedFromLastRun(lastSuccess) : 0;
      perPlatform[settings.provider] = {
        provider: settings.provider,
        provider_label: settings.providerLabel,
        auto_sync_enabled: settings.enabled,
        interval_hours: settings.intervalHours,
        last_success: lastSuccess,
        next_due_at: settings.enabled ? computeNextDueAt(lastSuccess, settings.intervalHours) : null,
        due_now: settings.enabled && isSyncDue(lastSuccess, settings.intervalHours),
        unlinked_devices_last_success: unlinked,
      };
    }

    return {
      mode: 'per-vehicle',
      in_progress: syncInProgress,
      last_run: lastRun,
      recent_runs: recent,
      platforms: perPlatform,
      // compat legado — espelha GPSWOX
      ...perPlatform.gpswox,
      provider: 'gpswox',
      provider_label: 'GPSWOX',
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

  async _resolveUserId(device, provider, defaultUserId) {
    const platformUserId = device.user_id || device.client_id || device.userId || null;
    const aguiaUserId = device.attributes?.aguia_user_id || device.aguia_user_id || null;

    if (aguiaUserId) {
      const user = await this.users.findById(String(aguiaUserId));
      if (user) return user.id;
    }

    if (platformUserId) {
      const user = await this.users.findByPlatformUserId(provider, String(platformUserId));
      if (user) return user.id;
    }

    return defaultUserId || null;
  }

  async importDevices({ provider, dryRun = false, defaultUserId } = {}) {
    const platform = normalizeProviderName(provider);
    const settings = await getSyncSettingsForProvider(platform);
    const providerLabel = getProviderLabel(platform);

    let response;
    try {
      response = await getTrackingService().listDevices(DEFAULT_TENANT_ID, platform);
    } catch (err) {
      logger.warn(`Sync ${providerLabel} indisponível.`, { err: err.message });
      return {
        provider: platform,
        provider_label: providerLabel,
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [{ reason: err.message }],
        preview: [],
        unavailable: true,
      };
    }

    const devices = normalizeDevicesResponse(response?.data || response);

    const summary = {
      provider: platform,
      provider_label: providerLabel,
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
        const userId = await this._resolveUserId(device, platform, defaultUserId);

        const modelName = extractTrackerModel(device);
        const trackerModelId = await this._resolveTrackerModelId(modelName);

        const payload = {
          tracking_provider: platform,
          tracker_device_id: deviceId,
          tracker_name: device.name || device.title || `Dispositivo ${deviceId}`,
          tracker_phone: extractSimNumber(device),
          tracker_model: modelName,
          tracker_model_id: trackerModelId,
          tracker_imei: extractImei(device),
          plate: extractPlate(device),
          tracker_synced_at: new Date().toISOString(),
        };

        const existing = await this.vehicles.findByDeviceId(deviceId, platform);

        if (dryRun) {
          summary.preview.push({
            device_id: deviceId,
            tracking_provider: platform,
            action: existing ? 'update' : userId ? 'create' : 'skip_no_user',
            ...payload,
            user_id: userId,
            customer_name: device.user_name || device.client_name || device.owner || null,
          });
          continue;
        }

        if (existing) {
          if (existing.tracking_provider && existing.tracking_provider !== platform) {
            summary.skipped += 1;
            summary.errors.push({
              device_id: deviceId,
              reason: `Device já vinculado à plataforma ${existing.tracking_provider}`,
            });
            continue;
          }
          await this.vehicles.update(existing.id, payload);
          await getExternalEntityMappingService().linkVehicle(
            existing.tenant_id || DEFAULT_TENANT_ID,
            { id: existing.id },
            platform,
            deviceId,
          );
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

        const created = await this.vehicles.create({
          user_id: userId,
          plate: payload.plate || payload.tracker_name.slice(0, 10).toUpperCase(),
          brand: device.brand || null,
          model: device.vehicle_model || device.model || null,
          status: 'active',
          ...payload,
        });
        await getExternalEntityMappingService().linkVehicle(
          created.tenant_id || DEFAULT_TENANT_ID,
          created,
          platform,
          deviceId,
        );
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

  async importAllPlatforms({ dryRun = false, defaultUserId } = {}) {
    const results = [];
    for (const provider of TRACKING_PROVIDERS) {
      results.push(await this.importDevices({ provider, dryRun, defaultUserId }));
    }
    return {
      platforms: results,
      total: results.reduce((sum, r) => sum + r.total, 0),
      created: results.reduce((sum, r) => sum + r.created, 0),
      updated: results.reduce((sum, r) => sum + r.updated, 0),
      skipped: results.reduce((sum, r) => sum + r.skipped, 0),
    };
  }

  async _runWithLog({ triggeredBy, dryRun, defaultUserId, provider, req } = {}) {
    const run = await this.runs.startRun({
      triggered_by: triggeredBy,
      dry_run: dryRun,
      provider: provider || 'all',
    });

    try {
      const summary = provider
        ? await this.importDevices({ provider, dryRun, defaultUserId })
        : await this.importAllPlatforms({ dryRun, defaultUserId });
      await this.runs.finishRun(run.id, { summary, success: true });

      if (!dryRun && req) {
        await getAuditService().adminAction('tracker.sync', {
          resourceType: 'vehicle',
          metadata: {
            triggered_by: triggeredBy,
            provider: provider || 'all',
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
      provider: options.provider || null,
      req,
    });
  }

  async runScheduledSync() {
    if (syncInProgress) {
      return null;
    }

    syncInProgress = true;
    const summaries = [];

    try {
      for (const provider of TRACKING_PROVIDERS) {
        const settings = await getSyncSettingsForProvider(provider);
        if (!settings.enabled) continue;

        const lastSuccess = await this.runs.getLastRun({ successOnly: true, provider });
        if (!isSyncDue(lastSuccess, settings.intervalHours)) continue;

        const providerLabel = getProviderLabel(provider);
        logger.info(`Iniciando sync ${providerLabel} agendado.`);
        try {
          const summary = await this._runWithLog({
            triggeredBy: 'scheduler',
            dryRun: false,
            provider,
          });
          summaries.push(summary);
          logger.info(`Sync ${providerLabel} concluído.`, {
            created: summary.created,
            updated: summary.updated,
            skipped: summary.skipped,
          });
        } catch (err) {
          logger.warn(`Sync ${providerLabel} falhou (outras plataformas continuam).`, { err: err.message });
        }
      }
      return summaries.length ? summaries : null;
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
