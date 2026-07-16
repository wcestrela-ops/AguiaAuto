const { getVehicleRepository, VEHICLE_STATUS } = require('../repositories/vehicle-repository');
const { getVehicleCommandLogRepository } = require('../repositories/vehicle-command-log-repository');
const gpswox = require('../integrations/gpswox-gateway');
const smsHub = require('../integrations/sms-hub');
const { VEHICLE_COMMANDS, normalizeVehicleAction } = require('../lib/vehicle-commands');
const { isGpsFailoverEligible, maskPhone } = require('../lib/gps-failover');
const { buildSmsIdempotencyKey } = require('../lib/idempotency');
const logger = require('../logger');

function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function defaultHistoryRange(hours = 24) {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  return { from: formatDateTime(from), to: formatDateTime(to) };
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
    gpswox_device_id: v.gpswox_device_id,
    gpswox_name: v.gpswox_name,
    tracker_phone: v.tracker_phone || null,
    tracker_phone_masked: v.tracker_phone ? maskPhone(v.tracker_phone) : null,
    label: [v.brand, v.model, v.plate].filter(Boolean).join(' · ') || v.plate,
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

    if (!vehicle.gpswox_device_id && !vehicle.gpswox_name) {
      throw new Error('Veículo ainda não vinculado ao rastreador.');
    }

    if (vehicle.status === VEHICLE_STATUS.PENDING_INSTALLATION) {
      throw new Error('Veículo aguardando instalação do rastreador.');
    }

    const location = await gpswox.getLocation({
      device_id: vehicle.gpswox_device_id,
      veiculo: vehicle.gpswox_name || vehicle.plate,
    });

    return {
      veiculo: formatVehicle(vehicle),
      localizacao: location,
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
    const command = VEHICLE_COMMANDS[normalized];

    return this._executeTrackerCommand(userId, vehicle, normalized, command);
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

      return {
        success: true,
        action: normalized,
        label: command.label,
        channel: '4g',
        failover: false,
        data,
        message: `${command.label} enviado via 4G.`,
      };
    } catch (gpsError) {
      logger.warn('Comando 4G falhou', {
        vehicleId: vehicle.id,
        action: normalized,
        error: gpsError.message,
      });

      if (!command.sms || !isGpsFailoverEligible(gpsError)) {
        throw gpsError;
      }

      if (!vehicle.tracker_phone) {
        throw new Error(
          'Comando 4G indisponível e veículo sem número do chip cadastrado para envio SMS.',
        );
      }

      const idempotencyKey = buildSmsIdempotencyKey(userId, vehicle.id, normalized);

      const smsData = await smsHub.sendTrackerCommand({
        phone: vehicle.tracker_phone,
        message: command.sms,
        action: normalized,
        vehicle_id: String(vehicle.id),
        user_id: String(userId),
        idempotencyKey,
      });

      if (normalized === 'bloquear') {
        await this.repo.update(vehicle.id, { status: VEHICLE_STATUS.BLOCKED });
      } else if (normalized === 'desbloquear') {
        await this.repo.update(vehicle.id, { status: VEHICLE_STATUS.ACTIVE });
      }

      await this._logCommand({
        vehicle_id: vehicle.id,
        user_id: userId,
        action: normalized,
        channel: 'sms',
        status: 'sent',
        failover: true,
        error_message: gpsError.message,
        external_ref: smsData?.dispatch_id || smsData?.id || null,
      });

      const duplicateNote = smsData?.duplicate ? ' (requisição duplicada ignorada)' : '';

      return {
        success: true,
        action: normalized,
        label: command.label,
        channel: 'sms',
        failover: true,
        data: smsData,
        message: `${command.label} enviado via SMS (4G indisponível)${duplicateNote}.`,
      };
    }
  }

  async _sendViaGps(vehicle, normalized, command) {
    if (normalized === 'bloquear') {
      return gpswox.blockDevice(vehicle.gpswox_device_id);
    }
    if (normalized === 'desbloquear') {
      return gpswox.unblockDevice(vehicle.gpswox_device_id);
    }
    return gpswox.sendCommand(vehicle.gpswox_device_id, command.gpswox);
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
    const range = from && to ? { from, to } : defaultHistoryRange(hours || 24);

    const response = await gpswox.getHistory(
      vehicle.gpswox_device_id,
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
    const response = await gpswox.createSharing(vehicle.gpswox_device_id, duration_minutes);
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
    if (!data.user_id || !data.plate) {
      throw new Error('user_id e plate são obrigatórios.');
    }
    const vehicle = await this.repo.create(data);
    return formatVehicle(vehicle);
  }

  async update(vehicleId, data) {
    const vehicle = await this.repo.update(vehicleId, data);
    return formatVehicle(vehicle);
  }

  async listAll() {
    const vehicles = await this.repo.listAll();
    return vehicles.map(v => ({
      ...formatVehicle(v),
      user_id: v.user_id,
      user_email: v.user_email,
      user_name: v.user_name,
    }));
  }

  async _requireDevice(vehicleId, userId) {
    const vehicle = await this.repo.findByIdForUser(vehicleId, userId);
    if (!vehicle) throw new Error('Veículo não encontrado.');
    if (!vehicle.gpswox_device_id) {
      throw new Error('Veículo sem device_id GPSWOX configurado.');
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
