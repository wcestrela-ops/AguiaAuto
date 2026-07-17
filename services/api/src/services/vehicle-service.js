const { getVehicleRepository, VEHICLE_STATUS } = require('../repositories/vehicle-repository');
const { getVehicleCommandLogRepository } = require('../repositories/vehicle-command-log-repository');
const { getUserRepository } = require('../repositories/user-repository');
const { getTrackingService } = require('./tracking-service');
const sms = require('./sms');
const firebase = require('./firebase');
const { VEHICLE_COMMANDS, normalizeVehicleAction } = require('../lib/vehicle-commands');
const { getTrackerCommandService } = require('./tracker-command-service');
const { isGpsFailoverEligible, maskPhone } = require('../lib/gps-failover');
const { buildCommandFeedback, formatCommandLogRow, normalizeSmsStatus } = require('../lib/command-feedback');
const { buildSmsIdempotencyKey } = require('../lib/idempotency');
const { getAuditService } = require('./audit-service');
const { formatVehicleFields } = require('../lib/tracker-fields');
const {
  normalizeProviderName,
  defaultHistoryRange,
  normalizeHistoryRange,
  missingTrackerDeviceError,
} = require('../lib/tracking-platform');
const { getLastPosition } = require('../infrastructure/tracking-cache');
const { trackVehicleViewer } = require('../infrastructure/presence');
const { enqueue, QUEUE_NAMES } = require('../infrastructure/queues');
const { isRedisEnabled } = require('../infrastructure/redis');
const logger = require('../logger');

function cacheToLocalizacao(cached) {
  if (!cached) return null;
  return {
    ...(cached.raw || {}),
    latitude: cached.latitude,
    longitude: cached.longitude,
    lat: cached.latitude,
    lng: cached.longitude,
    speed: cached.speed,
    velocidade: cached.speed,
    ignition: cached.ignition,
    ignicao: cached.ignition,
    online: cached.online,
    endereco: cached.address,
    address: cached.address,
    capturado_em: cached.device_time,
    provider: cached.provider,
    atualizado_em: cached.updated_at,
  };
}

function buildCacheMeta(cached) {
  if (!cached) {
    return { hit: false, refreshing: true };
  }
  const ageMs = Date.now() - new Date(cached.updated_at || 0).getTime();
  return {
    hit: true,
    age_ms: ageMs,
    stale: ageMs > parseInt(process.env.TRACKING_CACHE_STALE_MS || '60000', 10),
    refreshing: true,
  };
}

async function enqueuePositionRefresh(vehicle, userId) {
  if (!isRedisEnabled()) return;
  await trackVehicleViewer(String(vehicle.id), userId);
  await enqueue(
    QUEUE_NAMES.TRACKING_POSITION,
    'refresh',
    { vehicleDbId: vehicle.id, provider: vehicleProvider(vehicle) },
    {
      jobId: `pos-${vehicle.id}-${Math.floor(Date.now() / 10000)}`,
      removeOnComplete: true,
    },
  ).catch((err) => {
    logger.warn('Falha ao enfileirar refresh de posição.', { vehicleId: vehicle.id, err: err.message });
  });
}

function vehicleProvider(vehicle) {
  return normalizeProviderName(vehicle.tracking_provider || 'gpswox');
}

function formatVehicle(v) {
  return {
    id: v.id,
    plate: v.plate,
    brand: v.brand,
    model: v.model,
    color: v.color,
    year: v.year,
    status: v.status,
    ...formatVehicleFields(v),
    tracker_phone: v.tracker_phone || null,
    tracker_phone_masked: v.tracker_phone ? maskPhone(v.tracker_phone) : null,
    tracker_model: v.tracker_model || null,
    tracker_model_id: v.tracker_model_id || null,
    tracker_imei: v.tracker_imei || null,
    assigned_installer_id: v.assigned_installer_id || null,
    assigned_installer_name: v.assigned_installer_name || null,
    assigned_installer_email: v.assigned_installer_email || null,
    installation_scheduled_at: v.installation_scheduled_at || null,
    assigned_at: v.assigned_at || null,
    label: [v.brand, v.model, v.plate].filter(Boolean).join(' · ') || v.plate || 'Sem placa',
    created_at: v.created_at,
    updated_at: v.updated_at,
  };
}

class VehicleService {
  constructor() {
    this.repo = getVehicleRepository();
    this.commandLogs = getVehicleCommandLogRepository();
  }

  async listForUser(userId) {
    const vehicles = await this.repo.listByUser(userId);
    return vehicles.map(formatVehicle);
  }

  async getForUser(userId, vehicleId) {
    const vehicle = await this.repo.findByIdForUser(vehicleId, userId);
    if (!vehicle) throw new Error('Veículo não encontrado.');
    return formatVehicle(vehicle);
  }

  async getLocation(userId, vehicleId) {
    const vehicle = await this.repo.findByIdForUser(vehicleId, userId);
    if (!vehicle) throw new Error('Veículo não encontrado.');

    if (!vehicle.tracker_device_id && !vehicle.tracker_name) {
      throw new Error('Veículo ainda não vinculado ao rastreador.');
    }

    if (vehicle.status === VEHICLE_STATUS.PENDING_INSTALLATION) {
      throw new Error('Veículo aguardando instalação do rastreador.');
    }

    const cached = await getLastPosition(String(vehicle.id), vehicle.tenant_id);
    await enqueuePositionRefresh(vehicle, userId);

    if (cached) {
      return {
        veiculo: formatVehicle(vehicle),
        localizacao: cacheToLocalizacao(cached),
        cache: buildCacheMeta(cached),
      };
    }

    if (isRedisEnabled()) {
      return {
        veiculo: formatVehicle(vehicle),
        localizacao: null,
        cache: buildCacheMeta(null),
      };
    }

    const location = await gpswox.getLocation({
      device_id: vehicle.tracker_device_id,
      veiculo: vehicle.tracker_name || vehicle.plate,
      provider: vehicleProvider(vehicle),
    });

    return {
      veiculo: formatVehicle(vehicle),
      localizacao: location?.data || location?.localizacao || location,
      cache: { hit: false, refreshing: false, fallback: true },
    };
  }

  async block(userId, vehicleId) {
    return this.runCommand(userId, vehicleId, 'bloquear');
  }

  async unblock(userId, vehicleId) {
    return this.runCommand(userId, vehicleId, 'desbloquear');
  }

  async runCommand(userId, vehicleId, action) {
    const normalized = normalizeVehicleAction(action);
    if (!normalized) {
      throw new Error(`Comando inválido. Use: ${Object.keys(VEHICLE_COMMANDS).join(', ')}`);
    }

    const vehicle = await this._requireDevice(vehicleId, userId);
    const command = await getTrackerCommandService().resolveCommand(vehicle, normalized);
    if (!command) {
      throw new Error(`Comando "${action}" não configurado para este rastreador.`);
    }

    try {
      return await this._executeTrackerCommand(userId, vehicle, normalized, command);
    } catch (err) {
      await this._logCommand({
        vehicle_id: vehicle.id,
        user_id: userId,
        action: normalized,
        channel: err.command_channel || '4g',
        status: 'failed',
        failover: Boolean(err.failover_attempted),
        error_message: err.message,
      });
      throw err;
    }
  }

  async getCommandHistory(userId, vehicleId, { limit = 15 } = {}) {
    const vehicle = await this.repo.findByIdForUser(vehicleId, userId);
    if (!vehicle) throw new Error('Veículo não encontrado.');

    const rows = await this.commandLogs.listByVehicle(vehicleId, { userId, limit });
    return rows.map(formatCommandLogRow);
  }

  async _executeTrackerCommand(userId, vehicle, normalized, command) {
    try {
      const data = await this._sendViaGps(vehicle, normalized, command);

      if (normalized === 'bloquear') {
        await this.repo.update(vehicle.id, { status: VEHICLE_STATUS.BLOCKED });
      } else if (normalized === 'desbloquear') {
        await this.repo.update(vehicle.id, { status: VEHICLE_STATUS.ACTIVE });
      }

      await this._logCommand({
        vehicle_id: vehicle.id,
        user_id: userId,
        action: normalized,
        channel: '4g',
        status: 'sent',
        failover: false,
      });

      await getAuditService().userAction('vehicle.command', {
        userId,
        resourceType: 'vehicle',
        resourceId: vehicle.id,
        metadata: { action: normalized, channel: '4g', plate: vehicle.plate },
      });

      const commandFeedback = buildCommandFeedback({
        action: normalized,
        label: command.label,
        channel: '4g',
        failover: false,
        status: 'sent',
        hasTrackerPhone: Boolean(vehicle.tracker_phone),
      });

      return {
        success: true,
        action: normalized,
        label: command.label,
        channel: '4g',
        failover: false,
        data,
        message: commandFeedback.message,
        command_feedback: commandFeedback,
      };
    } catch (gpsError) {
      logger.warn('Comando 4G falhou', {
        vehicleId: vehicle.id,
        action: normalized,
        error: gpsError.message,
      });

      if (!command.sms || !isGpsFailoverEligible(gpsError)) {
        const err = new Error(gpsError.message);
        err.command_channel = '4g';
        throw err;
      }

      if (!vehicle.tracker_phone) {
        const err = new Error(
          'Comando 4G indisponível e veículo sem número do chip cadastrado para envio SMS.',
        );
        err.failover_attempted = true;
        err.command_channel = '4g';
        throw err;
      }

      const idempotencyKey = buildSmsIdempotencyKey(userId, vehicle.id, normalized);

      let smsData;
      try {
        smsData = await sms.sendTrackerCommand({
          phone: vehicle.tracker_phone,
          message: command.sms,
          action: normalized,
          vehicle_id: String(vehicle.id),
          user_id: String(userId),
          idempotencyKey,
        });
      } catch (smsError) {
        smsError.failover_attempted = true;
        smsError.command_channel = 'sms';
        throw smsError;
      }

      const smsStatus = normalizeSmsStatus(smsData);
      if (smsStatus === 'failed') {
        const err = new Error('Falha ao enviar SMS para o chip do rastreador.');
        err.failover_attempted = true;
        err.command_channel = 'sms';
        throw err;
      }

      if (normalized === 'bloquear' && smsStatus === 'sent') {
        await this.repo.update(vehicle.id, { status: VEHICLE_STATUS.BLOCKED });
      } else if (normalized === 'desbloquear' && smsStatus === 'sent') {
        await this.repo.update(vehicle.id, { status: VEHICLE_STATUS.ACTIVE });
      }

      await this._logCommand({
        vehicle_id: vehicle.id,
        user_id: userId,
        action: normalized,
        channel: 'sms',
        status: smsStatus === 'duplicate' ? 'duplicate' : smsStatus === 'queued' ? 'queued' : 'sent',
        failover: true,
        error_message: gpsError.message,
        external_ref: smsData?.dispatch_id || smsData?.id || null,
      });

      await getAuditService().userAction('vehicle.command.sms_failover', {
        userId,
        resourceType: 'vehicle',
        resourceId: vehicle.id,
        metadata: {
          action: normalized,
          channel: 'sms',
          dispatch_id: smsData?.dispatch_id,
          status: smsData?.status,
          duplicate: smsData?.duplicate,
        },
      });

      const commandFeedback = buildCommandFeedback({
        action: normalized,
        label: command.label,
        channel: 'sms',
        failover: true,
        status: smsStatus,
        smsData,
        hasTrackerPhone: true,
      });

      return {
        success: commandFeedback.success,
        action: normalized,
        label: command.label,
        channel: 'sms',
        failover: true,
        data: smsData,
        message: commandFeedback.message,
        command_feedback: commandFeedback,
      };
    }
  }

  async _sendViaGps(vehicle, normalized, command) {
    const tracking = getTrackingService();
    if (normalized === 'bloquear') {
      return tracking.blockDevice(vehicle);
    }
    if (normalized === 'desbloquear') {
      return tracking.unblockDevice(vehicle);
    }
    return tracking.sendCommand(vehicle, command.gpswox);
  }

  async _logCommand(entry) {
    try {
      await this.commandLogs.create(entry);
    } catch (err) {
      logger.error('Falha ao registrar log de comando', { error: err.message });
    }
  }

  async getHistory(userId, vehicleId, { from, to, hours } = {}) {
    const vehicle = await this._requireDevice(vehicleId, userId);
    const provider = vehicleProvider(vehicle);
    const range = from && to
      ? normalizeHistoryRange(from, to, provider)
      : defaultHistoryRange(hours || 24, provider);

    const response = await getTrackingService().getHistory(
      vehicle,
      range.from,
      range.to,
    );

    return {
      veiculo: formatVehicle(vehicle),
      ...range,
      ...(response.data || response),
    };
  }

  async shareLocation(userId, vehicleId, { duration_minutes = 60 } = {}) {
    const vehicle = await this._requireDevice(vehicleId, userId);
    const response = await getTrackingService().createSharing(vehicle, duration_minutes);
    const share = response.data || response;

    return {
      veiculo: formatVehicle(vehicle),
      compartilhamento: share,
    };
  }

  listCommands() {
    return Object.entries(VEHICLE_COMMANDS).map(([action, meta]) => ({
      action,
      label: meta.label,
      sms_available: Boolean(meta.sms),
    }));
  }

  async create(data) {
    if (!data.user_id) {
      throw new Error('user_id é obrigatório.');
    }
    const plate = data.plate ? String(data.plate).trim().toUpperCase() : null;
    if (plate) {
      const existing = await this.repo.findByPlate(plate);
      if (existing) throw new Error('Placa já cadastrada em outro veículo.');
    }
    const vehicle = await this.repo.create({ ...data, plate });
    return formatVehicle(vehicle);
  }

  async update(vehicleId, data) {
    const vehicle = await this.repo.update(vehicleId, data);
    return formatVehicle(vehicle);
  }

  async listAll(filters) {
    if (filters && Object.keys(filters).some((key) => filters[key])) {
      return this.listForAdmin(filters);
    }
    const vehicles = await this.repo.listAll();
    return vehicles.map(v => ({
      ...formatVehicle(v),
      user_id: v.user_id,
      user_email: v.user_email,
      user_name: v.user_name,
    }));
  }

  async listForAdmin(filters = {}) {
    const vehicles = await this.repo.listForAdmin(filters);
    return vehicles.map((v) => this._formatAdminVehicle(v));
  }

  async countForAdmin(filters = {}) {
    return this.repo.countForAdmin(filters);
  }

  async assignInstaller(vehicleId, { installer_id: installerId, installation_scheduled_at: scheduledAt }) {
    if (!installerId) {
      throw new Error('installer_id é obrigatório.');
    }

    const installer = await getUserRepository().findById(installerId);
    if (!installer || installer.role !== 'installer') {
      throw new Error('Instalador não encontrado.');
    }

    const vehicle = await this.repo.findById(vehicleId);
    if (!vehicle) throw new Error('Veículo não encontrado.');
    if (vehicle.status !== VEHICLE_STATUS.PENDING_INSTALLATION) {
      throw new Error('Só é possível atribuir instalador a veículos aguardando instalação.');
    }

    let parsedSchedule = null;
    if (scheduledAt) {
      parsedSchedule = new Date(scheduledAt);
      if (Number.isNaN(parsedSchedule.getTime())) {
        throw new Error('Data/hora de agendamento inválida.');
      }
    }

    const updated = await this.repo.assignInstaller(vehicleId, {
      installerId,
      scheduledAt: parsedSchedule,
    });

    const client = await getUserRepository().findById(vehicle.user_id);
    const label = updated.plate || [updated.brand, updated.model].filter(Boolean).join(' ') || `Veículo ${vehicleId}`;

    try {
      await firebase.sendPushToUser(installerId, {
        title: 'Nova instalação atribuída',
        body: `${label} — ${client?.name || client?.email || 'Cliente'}`,
        data: {
          type: 'installation_assigned',
          vehicle_id: String(vehicleId),
        },
      });
    } catch (err) {
      logger.warn('Push de atribuição de instalador não enviado.', { installerId, vehicleId, err: err.message });
    }

    const full = await this.repo.findByIdForAdmin(vehicleId);
    return this._formatAdminVehicle(full);
  }

  async unassignInstaller(vehicleId) {
    await this.repo.clearInstallerAssignment(vehicleId);
    const full = await this.repo.findByIdForAdmin(vehicleId);
    if (!full) throw new Error('Veículo não encontrado.');
    return this._formatAdminVehicle(full);
  }

  _formatAdminVehicle(v) {
    return {
      ...formatVehicle(v),
      user_id: v.user_id,
      user_email: v.user_email,
      user_name: v.user_name,
    };
  }

  async _requireDevice(vehicleId, userId) {
    const vehicle = await this.repo.findByIdForUser(vehicleId, userId);
    if (!vehicle) throw new Error('Veículo não encontrado.');
    if (!vehicle.tracker_device_id) {
      throw new Error(missingTrackerDeviceError(vehicle.tracking_provider));
    }
    return vehicle;
  }
}

let instance = null;

function getVehicleService() {
  if (!instance) instance = new VehicleService();
  return instance;
}

module.exports = { VehicleService, getVehicleService, formatVehicle };
