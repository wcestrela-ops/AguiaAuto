const { getVehicleRepository, VEHICLE_STATUS } = require('../repositories/vehicle-repository');
const gpswox = require('../integrations/gpswox-gateway');
const logger = require('../logger');

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
