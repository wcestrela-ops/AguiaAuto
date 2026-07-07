const fs = require('fs');
const { getContractRepository } = require('../repositories/contract-repository');
const { getInstallationRepository } = require('../repositories/installation-repository');
const { getInstallationPhotoRepository } = require('../repositories/installation-photo-repository');
const { getVehicleRepository } = require('../repositories/vehicle-repository');
const { resolveUploadPath } = require('../lib/upload');

function formatPhoto(photo, baseUrl = '') {
  return {
    id: photo.id,
    url: `${baseUrl}/v1/contratos/fotos/${photo.id}`,
    original_filename: photo.original_filename,
    sort_order: photo.sort_order,
  };
}

function formatInstallationReport(row, photos = [], { accepted = null, baseUrl = '' } = {}) {
  return {
    id: row.id,
    vehicle_id: row.vehicle_id,
    plate: row.plate,
    vehicle_label: [row.brand, row.model, row.plate].filter(Boolean).join(' · ') || row.plate,
    installer_name: row.installer_name,
    gpswox_device_id: row.gpswox_device_id,
    imei: row.imei,
    notes: row.notes,
    report: row.report,
    duration_minutes: row.duration_minutes,
    started_at: row.started_at,
    finished_at: row.finished_at,
    created_at: row.created_at,
    photos: photos.map((p) => formatPhoto(p, baseUrl)),
    accepted: accepted ? {
      id: accepted.id,
      accepted_at: accepted.accepted_at,
    } : null,
    pending_acceptance: !accepted,
  };
}

class ContractService {
  constructor() {
    this.contracts = getContractRepository();
    this.installations = getInstallationRepository();
    this.photos = getInstallationPhotoRepository();
    this.vehicles = getVehicleRepository();
  }

  async getOverview(userId, baseUrl = '') {
    const serviceTemplate = await this.contracts.findTemplateBySlug('contrato-prestacao');
    const deliveryTemplate = await this.contracts.findTemplateBySlug('termo-entrega-instalacao');
    const serviceAccepted = await this.contracts.findAcceptanceByUserAndType(userId, 'service');

    const [pendingRows, acceptedRows] = await Promise.all([
      this.contracts.listPendingDeliveriesForUser(userId),
      this.contracts.listAcceptedDeliveriesForUser(userId),
    ]);

    const pendingDeliveries = await Promise.all(
      pendingRows.map(async (row) => {
        const photoRows = await this.photos.listByInstallationLog(row.id);
        return formatInstallationReport(row, photoRows, { baseUrl });
      })
    );

    const acceptedDeliveries = await Promise.all(
      acceptedRows.map(async (row) => {
        const photoRows = await this.photos.listByInstallationLog(row.id);
        return formatInstallationReport(row, photoRows, {
          accepted: { id: row.acceptance_id, accepted_at: row.accepted_at },
          baseUrl,
        });
      })
    );

    return {
      contrato_servico: serviceTemplate ? {
        template_id: serviceTemplate.id,
        slug: serviceTemplate.slug,
        title: serviceTemplate.title,
        body_html: serviceTemplate.body_html,
        version: serviceTemplate.version,
        accepted: Boolean(serviceAccepted),
        accepted_at: serviceAccepted?.accepted_at || null,
      } : null,
      termo_entrega: deliveryTemplate ? {
        template_id: deliveryTemplate.id,
        slug: deliveryTemplate.slug,
        title: deliveryTemplate.title,
        body_html: deliveryTemplate.body_html,
        version: deliveryTemplate.version,
      } : null,
      entregas_pendentes: pendingDeliveries,
      entregas_aceitas: acceptedDeliveries,
      pendentes_total: pendingDeliveries.length + (serviceAccepted ? 0 : 1),
    };
  }

  async acceptServiceContract(userId, reqMeta = {}) {
    const existing = await this.contracts.findAcceptanceByUserAndType(userId, 'service');
    if (existing) {
      return { already_accepted: true, acceptance: existing };
    }

    const template = await this.contracts.findTemplateBySlug('contrato-prestacao');
    if (!template) throw new Error('Modelo de contrato não encontrado.');

    const acceptance = await this.contracts.createAcceptance({
      user_id: userId,
      template_id: template.id,
      template_version: template.version,
      acceptance_type: 'service',
      ip_address: reqMeta.ip,
      user_agent: reqMeta.userAgent,
    });

    return { acceptance };
  }

  async acceptInstallationDelivery(userId, installationLogId, reqMeta = {}) {
    const log = await this.installations.findById(installationLogId);
    if (!log) throw new Error('Relatório de instalação não encontrado.');
    if (log.user_id !== userId) throw new Error('Relatório não pertence a este cliente.');

    const existing = await this.contracts.findAcceptanceByUserAndType(
      userId,
      'installation_delivery',
      { installationLogId }
    );
    if (existing) {
      return { already_accepted: true, acceptance: existing };
    }

    const template = await this.contracts.findTemplateBySlug('termo-entrega-instalacao');
    if (!template) throw new Error('Modelo de termo de entrega não encontrado.');

    const acceptance = await this.contracts.createAcceptance({
      user_id: userId,
      vehicle_id: log.vehicle_id,
      template_id: template.id,
      template_version: template.version,
      acceptance_type: 'installation_delivery',
      installation_log_id: installationLogId,
      ip_address: reqMeta.ip,
      user_agent: reqMeta.userAgent,
    });

    return { acceptance };
  }

  async getPhotoForUser(userId, photoId, { role } = {}) {
    const photo = await this.photos.findById(photoId);
    if (!photo) throw new Error('Foto não encontrada.');

    const isOwner = photo.user_id === userId;
    const isStaff = role === 'installer' || role === 'admin';
    if (!isOwner && !isStaff) throw new Error('Acesso negado.');

    const fullPath = resolveUploadPath(photo.file_path);
    if (!fs.existsSync(fullPath)) throw new Error('Arquivo não encontrado.');

    return { fullPath, photo };
  }

  async getInstallationForVehicle(userId, vehicleId, baseUrl = '') {
    const vehicle = await this.vehicles.findByIdForUser(vehicleId, userId);
    if (!vehicle) throw new Error('Veículo não encontrado.');

    const log = await this.installations.findLatestByVehicle(vehicleId);
    if (!log) return null;

    const photoRows = await this.photos.listByInstallationLog(log.id);
    const acceptance = await this.contracts.findAcceptanceByUserAndType(
      userId,
      'installation_delivery',
      { installationLogId: log.id }
    );

    return formatInstallationReport(
      { ...log, plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model },
      photoRows,
      { accepted: acceptance, baseUrl }
    );
  }
}

let instance = null;

function getContractService() {
  if (!instance) instance = new ContractService();
  return instance;
}

module.exports = { ContractService, getContractService, formatInstallationReport, formatPhoto };
