const { getVehicleRepository, VEHICLE_STATUS } = require('../repositories/vehicle-repository');
const { getInstallationRepository } = require('../repositories/installation-repository');
const { getUserRepository } = require('../repositories/user-repository');
const { formatVehicle } = require('./vehicle-service');
const gpswox = require('../integrations/gpswox-gateway');
const firebase = require('./firebase');
const logger = require('../logger');

function formatPendingJob(row) {
  return {
    id: row.id,
    vehicle_id: row.id,
    plate: row.plate,
    brand: row.brand,
    model: row.model,
    color: row.color,
    year: row.year,
    status: row.status,
    gpswox_device_id: row.gpswox_device_id,
    gpswox_name: row.gpswox_name,
    label: [row.brand, row.model, row.plate].filter(Boolean).join(' · ') || row.plate,
    client: {
      id: row.user_id,
      name: row.user_name,
      email: row.user_email,
      phone: row.user_phone,
    },
    created_at: row.created_at,
  };
}

class InstallerService {
  constructor() {
    this.vehicles = getVehicleRepository();
    this.installations = getInstallationRepository();
    this.users = getUserRepository();
  }

  async getDashboard(installerId) {
    const [pending, completed] = await Promise.all([
      this.vehicles.countByStatus(VEHICLE_STATUS.PENDING_INSTALLATION),
      this.installations.listByInstaller(installerId, { limit: 5 }),
    ]);

    return {
      pendentes: pending,
      concluidas_recentes: completed.length,
      ultimas_instalacoes: completed.map((row) => ({
        id: row.id,
        vehicle_id: row.vehicle_id,
        plate: row.plate,
        client_name: row.client_name,
        gpswox_device_id: row.gpswox_device_id,
        created_at: row.created_at,
      })),
    };
  }

  async listPending() {
    const rows = await this.vehicles.listPendingInstallations();
    return rows.map(formatPendingJob);
  }

  async getJob(vehicleId) {
    const vehicle = await this.vehicles.findById(vehicleId);
    if (!vehicle) throw new Error('Instalação não encontrada.');

    const user = await this.users.findById(vehicle.user_id);
    return {
      ...formatPendingJob({
        ...vehicle,
        user_name: user?.name,
        user_email: user?.email,
        user_phone: user?.phone,
      }),
      vehicle: formatVehicle(vehicle),
    };
  }

  async finalizeInstallation(installerId, vehicleId, data) {
    const { gpswox_device_id, gpswox_name, imei, notes, create_in_gpswox } = data;

    if (!gpswox_device_id) {
      throw new Error('gpswox_device_id é obrigatório para finalizar.');
    }

    const vehicle = await this.vehicles.findById(vehicleId);
    if (!vehicle) throw new Error('Veículo não encontrado.');

    if (vehicle.status !== VEHICLE_STATUS.PENDING_INSTALLATION) {
      throw new Error('Veículo não está aguardando instalação.');
    }

    const deviceName = gpswox_name || vehicle.plate;

    if (create_in_gpswox) {
      try {
        await gpswox.createVeiculo({
          device_id: gpswox_device_id,
          imei: imei || gpswox_device_id,
          name: deviceName,
          plate: vehicle.plate,
        });
      } catch (err) {
        logger.warn('Falha ao criar veículo no GPSWOX (continuando).', { vehicleId, err: err.message });
      }
    }

    const updated = await this.vehicles.update(vehicleId, {
      gpswox_device_id,
      gpswox_name: deviceName,
      status: VEHICLE_STATUS.ACTIVE,
    });

    const log = await this.installations.create({
      vehicle_id: vehicleId,
      installer_id: installerId,
      gpswox_device_id,
      imei: imei || null,
      notes: notes || null,
    });

    try {
      await firebase.sendPushToUser(vehicle.user_id, {
        title: 'Rastreador instalado — Águia',
        body: `Seu veículo ${vehicle.plate} está ativo. Acompanhe pelo app.`,
        data: { type: 'installation_complete', vehicle_id: String(vehicleId) },
      });
    } catch (err) {
      logger.warn('Push pós-instalação não enviado.', { userId: vehicle.user_id, err: err.message });
    }

    return {
      vehicle: formatVehicle(updated),
      installation: log,
    };
  }

  async listHistory(installerId) {
    return this.installations.listByInstaller(installerId);
  }

  async createInstaller({ email, password, name, phone }) {
    if (!email || !password) throw new Error('Email e senha são obrigatórios.');
    const existing = await this.users.findByEmail(email);
    if (existing) throw new Error('Email já cadastrado.');

    return this.users.create({
      email,
      password,
      name,
      phone,
      role: 'installer',
    });
  }

  async listInstallers() {
    const all = await this.users.listAll();
    return all.filter(u => u.role === 'installer');
  }
}

let instance = null;

function getInstallerService() {
  if (!instance) instance = new InstallerService();
  return instance;
}

module.exports = { InstallerService, getInstallerService, formatPendingJob };
