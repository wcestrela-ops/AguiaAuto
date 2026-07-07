const { getVehicleRepository, VEHICLE_STATUS } = require('../repositories/vehicle-repository');
const gpswox = require('../integrations/gpswox-gateway');
const { VEHICLE_COMMANDS, normalizeVehicleAction } = require('../lib/vehicle-commands');
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
    label: [v.brand, v.model, v.plate].filter(Boolean).join(' · ') || v.plate,
    created_at: v.created_at,
    updated_at: v.updated_at,
  };
}

class VehicleService {
  constructor() {
    this.repo = getVehicleRepository();
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
    const vehicle = await this._requireDevice(vehicleId, userId);
    const data = await gpswox.blockDevice(vehicle.gpswox_device_id);
    await this.repo.update(vehicleId, { status: VEHICLE_STATUS.BLOCKED });
    return { success: true, data };
  }

  async unblock(userId, vehicleId) {
    const vehicle = await this._requireDevice(vehicleId, userId);
    const data = await gpswox.unblockDevice(vehicle.gpswox_device_id);
    await this.repo.update(vehicleId, { status: VEHICLE_STATUS.ACTIVE });
    return { success: true, data };
  }

  async runCommand(userId, vehicleId, action) {
    const normalized = normalizeVehicleAction(action);
    if (!normalized) {
      throw new Error(`Comando inválido. Use: ${Object.keys(VEHICLE_COMMANDS).join(', ')}`);
    }

    const vehicle = await this._requireDevice(vehicleId, userId);
    const command = VEHICLE_COMMANDS[normalized];

    if (normalized === 'bloquear') {
      return this.block(userId, vehicleId);
    }
    if (normalized === 'desbloquear') {
      return this.unblock(userId, vehicleId);
    }

    const data = await gpswox.sendCommand(vehicle.gpswox_device_id, command.gpswox);
    return {
      success: true,
      action: normalized,
      label: command.label,
      data,
    };
  }

  async getHistory(userId, vehicleId, { from, to, hours } = {}) {
    const vehicle = await this._requireDevice(vehicleId, userId);
    const range = from && to ? { from, to } : defaultHistoryRange(hours || 24);

    const response = await gpswox.getHistory(
      vehicle.gpswox_device_id,
      range.from,
      range.to
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
