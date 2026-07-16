const { getVehicleRepository, VEHICLE_STATUS } = require('../repositories/vehicle-repository');
const { getInstallationRepository } = require('../repositories/installation-repository');
const { getInstallationPhotoRepository } = require('../repositories/installation-photo-repository');
const { getUserRepository } = require('../repositories/user-repository');
const { getTrackerModelRepository } = require('../repositories/tracker-model-repository');
const { getTrackerCommandService } = require('./tracker-command-service');
const { formatVehicle } = require('./vehicle-service');
const gpswox = require('../integrations/gpswox-gateway');
const firebase = require('./firebase');
const logger = require('../logger');
const { movePhotosToInstallation, MAX_PHOTOS } = require('../lib/upload');
const {
  normalizeImei,
  isValidImei,
  normalizeTrackerPhone,
  isValidTrackerPhone,
} = require('../lib/imei');

const MIN_PHOTOS = 1;

function formatPendingJob(row, viewerInstallerId = null) {
  const assignedToOther = row.assigned_installer_id
    && viewerInstallerId
    && row.assigned_installer_id !== viewerInstallerId;

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
    label: [row.brand, row.model, row.plate].filter(Boolean).join(' · ') || row.plate || 'Sem placa',
    client: {
      id: row.user_id,
      name: row.user_name,
      email: row.user_email,
      phone: row.user_phone,
    },
    assigned_installer_id: row.assigned_installer_id || null,
    assigned_installer_name: row.assigned_installer_name || null,
    installation_scheduled_at: row.installation_scheduled_at || null,
    assigned_at: row.assigned_at || null,
    is_pool: !row.assigned_installer_id,
    assigned_to_me: viewerInstallerId
      ? (!row.assigned_installer_id || row.assigned_installer_id === viewerInstallerId)
      : undefined,
    can_finalize: viewerInstallerId ? !assignedToOther : true,
    created_at: row.created_at,
  };
}

function parseDurationMinutes(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return null;
  if (parsed > 24 * 60) throw new Error('Duração inválida (máximo 24 horas).');
  return parsed;
}

class InstallerService {
  constructor() {
    this.vehicles = getVehicleRepository();
    this.installations = getInstallationRepository();
    this.photos = getInstallationPhotoRepository();
    this.users = getUserRepository();
  }

  async getDashboard(installerId) {
    const [pending, completed] = await Promise.all([
      this.vehicles.countPendingForInstaller(installerId),
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
        duration_minutes: row.duration_minutes,
        created_at: row.created_at,
      })),
    };
  }

  async listPending(installerId) {
    const rows = await this.vehicles.listPendingInstallations(installerId);
    return rows.map((row) => formatPendingJob(row, installerId));
  }

  _assertInstallerAccess(vehicle, installerId, userRole) {
    if (userRole === 'admin') return;
    if (vehicle.status !== VEHICLE_STATUS.PENDING_INSTALLATION) {
      throw new Error('Instalação não encontrada.');
    }
    if (vehicle.assigned_installer_id && vehicle.assigned_installer_id !== installerId) {
      throw new Error('Esta instalação está atribuída a outro instalador.');
    }
  }

  async getJob(vehicleId, installerId, userRole = 'installer') {
    const vehicle = await this.vehicles.findById(vehicleId);
    if (!vehicle || vehicle.status !== VEHICLE_STATUS.PENDING_INSTALLATION) {
      throw new Error('Instalação não encontrada.');
    }

    this._assertInstallerAccess(vehicle, installerId, userRole);

    const user = await this.users.findById(vehicle.user_id);
    const installerRow = vehicle.assigned_installer_id
      ? await this.users.findById(vehicle.assigned_installer_id)
      : null;

    return {
      ...formatPendingJob({
        ...vehicle,
        user_name: user?.name,
        user_email: user?.email,
        user_phone: user?.phone,
        assigned_installer_name: installerRow?.name || installerRow?.email || null,
      }, installerId),
      vehicle: formatVehicle({
        ...vehicle,
        assigned_installer_name: installerRow?.name || installerRow?.email || null,
      }),
    };
  }

  async listTrackerModels() {
    return getTrackerCommandService().listModelsWithCommands();
  }

  async finalizeInstallation(installerId, vehicleId, data, uploadedFiles = [], userRole = 'installer') {
    const {
      gpswox_device_id,
      gpswox_name,
      plate,
      imei,
      tracker_phone,
      tracker_model_id,
      notes,
      report,
      duration_minutes,
      create_in_gpswox,
    } = data;

    if (!gpswox_device_id) {
      throw new Error('gpswox_device_id é obrigatório para finalizar.');
    }

    const normalizedImei = normalizeImei(imei);
    if (!isValidImei(normalizedImei)) {
      throw new Error('IMEI inválido — informe 15 dígitos válidos.');
    }

    const normalizedPhone = normalizeTrackerPhone(tracker_phone);
    if (!isValidTrackerPhone(normalizedPhone)) {
      throw new Error('Chip SIM inválido — informe o número com DDD (10 a 13 dígitos).');
    }

    const modelId = parseInt(tracker_model_id, 10);
    if (Number.isNaN(modelId)) {
      throw new Error('Modelo do rastreador é obrigatório.');
    }

    const trackerModel = await getTrackerModelRepository().findById(modelId);
    if (!trackerModel) {
      throw new Error('Modelo de rastreador não encontrado.');
    }

    if (!report || !String(report).trim()) {
      throw new Error('Relatório da instalação é obrigatório.');
    }

    if (String(report).trim().length < 20) {
      throw new Error('Relatório muito curto — descreva a instalação com mais detalhes.');
    }

    const duration = parseDurationMinutes(duration_minutes);
    if (!duration) {
      throw new Error('Informe a duração da instalação em minutos.');
    }

    if (uploadedFiles.length < MIN_PHOTOS) {
      throw new Error(`Adicione pelo menos ${MIN_PHOTOS} foto da instalação.`);
    }

    if (uploadedFiles.length > MAX_PHOTOS) {
      throw new Error(`Máximo de ${MAX_PHOTOS} fotos por instalação.`);
    }

    const vehicle = await this.vehicles.findById(vehicleId);
    if (!vehicle) throw new Error('Veículo não encontrado.');

    if (vehicle.status !== VEHICLE_STATUS.PENDING_INSTALLATION) {
      throw new Error('Veículo não está aguardando instalação.');
    }

    this._assertInstallerAccess(vehicle, installerId, userRole);

    const normalizedPlate = plate ? String(plate).trim().toUpperCase() : null;
    if (normalizedPlate) {
      const existing = await this.vehicles.findByPlate(normalizedPlate);
      if (existing && existing.id !== vehicleId) {
        throw new Error('Placa já cadastrada em outro veículo.');
      }
    }

    const resolvedPlate = normalizedPlate || vehicle.plate;
    const deviceName = gpswox_name
      || resolvedPlate
      || [vehicle.brand, vehicle.model].filter(Boolean).join(' ')
      || `Veículo ${vehicle.id}`;
    const finishedAt = new Date();
    const startedAt = new Date(finishedAt.getTime() - duration * 60 * 1000);

    if (create_in_gpswox === true || create_in_gpswox === 'true') {
      try {
        await gpswox.createVeiculo({
          device_id: gpswox_device_id,
          imei: normalizedImei,
          name: deviceName,
          plate: resolvedPlate,
        });
      } catch (err) {
        logger.warn('Falha ao criar veículo no GPSWOX (continuando).', { vehicleId, err: err.message });
      }
    }

    const updated = await this.vehicles.update(vehicleId, {
      gpswox_device_id,
      gpswox_name: deviceName,
      plate: normalizedPlate || undefined,
      status: VEHICLE_STATUS.ACTIVE,
      tracker_imei: normalizedImei,
      tracker_phone: normalizedPhone,
      tracker_model_id: modelId,
      tracker_model: trackerModel.name,
      assigned_installer_id: null,
      installation_scheduled_at: null,
      assigned_at: null,
    });

    const log = await this.installations.create({
      vehicle_id: vehicleId,
      installer_id: installerId,
      gpswox_device_id,
      imei: normalizedImei,
      notes: notes || null,
      report: String(report).trim(),
      duration_minutes: duration,
      started_at: startedAt,
      finished_at: finishedAt,
    });

    let savedPhotos = [];
    if (uploadedFiles.length > 0) {
      const moved = movePhotosToInstallation(uploadedFiles, log.id);
      savedPhotos = await this.photos.createMany(log.id, moved);
    }

    try {
      await firebase.sendPushToUser(vehicle.user_id, {
        title: 'Instalação concluída — confirme no app',
        body: `Relatório de instalação do veículo ${resolvedPlate || deviceName} disponível em Contratos.`,
        data: {
          type: 'installation_report',
          vehicle_id: String(vehicleId),
          installation_log_id: String(log.id),
        },
      });
    } catch (err) {
      logger.warn('Push pós-instalação não enviado.', { userId: vehicle.user_id, err: err.message });
    }

    return {
      vehicle: formatVehicle(updated),
      installation: {
        ...log,
        photos: savedPhotos,
      },
    };
  }

  async listHistory(installerId) {
    return this.installations.listByInstaller(installerId);
  }

  async createInstaller({ email, password, name, phone }) {
    if (!email || !password) throw new Error('Email e senha são obrigatórios.');
    const existing = await this.users.findByEmail(email);
    if (existing) throw new Error('Email já cadastrado.');

    const user = await this.users.create({
      email,
      password,
      name,
      phone,
      role: 'installer',
    });

    const authNotifications = require('./auth-notifications');
    authNotifications.sendAccountCredentials({
      user,
      password,
      roleLabel: 'instalador',
    }).catch((err) => {
      logger.warn('Credenciais do instalador não enviadas.', { email, err: err.message });
    });

    return user;
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
