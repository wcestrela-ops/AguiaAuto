const fs = require('fs');
const { getContractRepository } = require('../repositories/contract-repository');
const { getInstallationRepository } = require('../repositories/installation-repository');
const { getInstallationPhotoRepository } = require('../repositories/installation-photo-repository');
const { getVehicleRepository } = require('../repositories/vehicle-repository');
const { getUserRepository } = require('../repositories/user-repository');
const { resolveUploadPath } = require('../lib/upload');
const {
  buildFullContractDocument,
  buildInstallationDocument,
} = require('../lib/contract-document');
const logger = require('../logger');

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
    tracker_device_id: row.tracker_device_id,
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
    this.users = getUserRepository();
  }

  async _loadDeliveriesWithPhotos(rows, baseUrl, acceptedMapper) {
    return Promise.all(
      rows.map(async (row) => {
        const photoRows = await this.photos.listByInstallationLog(row.id);
        const accepted = acceptedMapper ? acceptedMapper(row) : null;
        return formatInstallationReport(row, photoRows, { accepted, baseUrl });
      })
    );
  }

  async getOverview(userId, baseUrl = '') {
    const serviceTemplate = await this.contracts.findTemplateBySlug('contrato-prestacao');
    const deliveryTemplate = await this.contracts.findTemplateBySlug('termo-entrega-instalacao');
    const serviceAccepted = await this.contracts.findAcceptanceByUserAndType(userId, 'service');
    const user = await this.users.findById(userId);

    const [pendingRows, acceptedRows] = await Promise.all([
      this.contracts.listPendingDeliveriesForUser(userId),
      this.contracts.listAcceptedDeliveriesForUser(userId),
    ]);

    const pendingDeliveries = await this._loadDeliveriesWithPhotos(pendingRows, baseUrl);
    const acceptedDeliveries = await this._loadDeliveriesWithPhotos(
      acceptedRows,
      baseUrl,
      (row) => ({ id: row.acceptance_id, accepted_at: row.accepted_at })
    );

    const previewDocument = !serviceAccepted && serviceTemplate
      ? buildFullContractDocument({
        serviceTemplate,
        deliveryTemplate,
        installations: pendingDeliveries,
        clientName: user?.name,
        clientEmail: user?.email,
      })
      : null;

    return {
      contrato_servico: serviceTemplate ? {
        template_id: serviceTemplate.id,
        slug: serviceTemplate.slug,
        title: serviceTemplate.title,
        body_html: serviceTemplate.body_html,
        version: serviceTemplate.version,
        accepted: Boolean(serviceAccepted),
        accepted_at: serviceAccepted?.accepted_at || null,
        acceptance_id: serviceAccepted?.id || null,
        has_pending_installations: pendingDeliveries.length > 0,
        unified_acceptance: pendingDeliveries.length > 0,
      } : null,
      termo_entrega: deliveryTemplate ? {
        template_id: deliveryTemplate.id,
        slug: deliveryTemplate.slug,
        title: deliveryTemplate.title,
        body_html: deliveryTemplate.body_html,
        version: deliveryTemplate.version,
      } : null,
      instalacoes_incluidas: pendingDeliveries,
      entregas_pendentes: pendingDeliveries,
      entregas_aceitas: acceptedDeliveries,
      preview_documento_html: previewDocument,
      pendentes_total: pendingDeliveries.length + (serviceAccepted ? 0 : 1),
    };
  }

  async acceptServiceContract(userId, reqMeta = {}) {
    const existing = await this.contracts.findAcceptanceByUserAndType(userId, 'service');
    if (existing) {
      const pending = await this._acceptPendingDeliveries(userId, reqMeta, existing.snapshot_html);
      return { already_accepted: true, acceptance: existing, deliveries_accepted: pending };
    }

    const user = await this.users.findById(userId);
    const serviceTemplate = await this.contracts.findTemplateBySlug('contrato-prestacao');
    const deliveryTemplate = await this.contracts.findTemplateBySlug('termo-entrega-instalacao');
    if (!serviceTemplate) throw new Error('Modelo de contrato não encontrado.');

    const pendingRows = await this.contracts.listPendingDeliveriesForUser(userId);
    const pendingDeliveries = await this._loadDeliveriesWithPhotos(pendingRows, '');

    const snapshotHtml = buildFullContractDocument({
      serviceTemplate,
      deliveryTemplate,
      installations: pendingDeliveries,
      clientName: user?.name,
      clientEmail: user?.email,
      acceptedAt: new Date(),
    });

    const acceptance = await this.contracts.createAcceptance({
      user_id: userId,
      template_id: serviceTemplate.id,
      template_version: serviceTemplate.version,
      acceptance_type: 'service',
      ip_address: reqMeta.ip,
      user_agent: reqMeta.userAgent,
      snapshot_html: snapshotHtml,
    });

    const deliveriesAccepted = await this._acceptPendingDeliveries(
      userId,
      reqMeta,
      snapshotHtml,
      deliveryTemplate
    );

    const { getReferralService } = require('./referral-service');
    getReferralService().checkAndRewardForReferredUser(userId).catch((err) => {
      logger.warn('Falha ao processar indicação após contrato.', { userId, err: err.message });
    });

    return { acceptance, deliveries_accepted: deliveriesAccepted, unified: deliveriesAccepted.length > 0 };
  }

  async _acceptPendingDeliveries(userId, reqMeta, sharedSnapshot, deliveryTemplate = null) {
    const template = deliveryTemplate
      || await this.contracts.findTemplateBySlug('termo-entrega-instalacao');
    const pendingRows = await this.contracts.listPendingDeliveriesForUser(userId);
    const accepted = [];

    for (const row of pendingRows) {
      const existing = await this.contracts.findAcceptanceByUserAndType(
        userId,
        'installation_delivery',
        { installationLogId: row.id }
      );
      if (existing) continue;

      const user = await this.users.findById(userId);
      const delivery = formatInstallationReport(row, await this.photos.listByInstallationLog(row.id));
      const snapshot = sharedSnapshot || buildInstallationDocument({
        delivery,
        deliveryTemplate: template,
        clientName: user?.name,
        clientEmail: user?.email,
        acceptedAt: new Date(),
      });

      const record = await this.contracts.createAcceptance({
        user_id: userId,
        vehicle_id: row.vehicle_id,
        template_id: template.id,
        template_version: template.version,
        acceptance_type: 'installation_delivery',
        installation_log_id: row.id,
        ip_address: reqMeta.ip,
        user_agent: reqMeta.userAgent,
        snapshot_html: snapshot,
      });
      accepted.push(record);
    }

    if (accepted.length) {
      const { getReferralService } = require('./referral-service');
      getReferralService().checkAndRewardForReferredUser(userId).catch((err) => {
        logger.warn('Falha ao processar indicação após entregas.', { userId, err: err.message });
      });
    }

    return accepted;
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

    const serviceAccepted = await this.contracts.hasServiceAcceptance(userId);
    if (!serviceAccepted) {
      throw new Error('Aceite o contrato de serviço primeiro. O termo de instalação é incluído no mesmo aceite.');
    }

    const template = await this.contracts.findTemplateBySlug('termo-entrega-instalacao');
    if (!template) throw new Error('Modelo de termo de entrega não encontrado.');

    const user = await this.users.findById(userId);
    const vehicle = await this.vehicles.findById(log.vehicle_id);
    const delivery = formatInstallationReport(
      { ...log, plate: vehicle?.plate, brand: vehicle?.brand, model: vehicle?.model, installer_name: log.installer_name },
      await this.photos.listByInstallationLog(log.id)
    );

    const snapshotHtml = buildInstallationDocument({
      delivery,
      deliveryTemplate: template,
      clientName: user?.name,
      clientEmail: user?.email,
      acceptedAt: new Date(),
    });

    const acceptance = await this.contracts.createAcceptance({
      user_id: userId,
      vehicle_id: log.vehicle_id,
      template_id: template.id,
      template_version: template.version,
      acceptance_type: 'installation_delivery',
      installation_log_id: installationLogId,
      ip_address: reqMeta.ip,
      user_agent: reqMeta.userAgent,
      snapshot_html: snapshotHtml,
    });

    const { getReferralService } = require('./referral-service');
    getReferralService().checkAndRewardForReferredUser(userId).catch((err) => {
      logger.warn('Falha ao processar indicação após termo de entrega.', { userId, err: err.message });
    });

    return { acceptance };
  }

  async getDownloadDocument(userId, { type = 'servico', installationLogId } = {}) {
    if (type === 'servico') {
      const acceptance = await this.contracts.findAcceptanceByUserAndType(userId, 'service');
      if (!acceptance?.snapshot_html) {
        throw new Error('Contrato ainda não assinado ou cópia indisponível.');
      }
      return {
        filename: 'contrato-prestacao-servicos.html',
        html: acceptance.snapshot_html,
      };
    }

    if (type === 'entrega' && installationLogId) {
      const acceptance = await this.contracts.findAcceptanceByUserAndType(
        userId,
        'installation_delivery',
        { installationLogId }
      );
      if (!acceptance?.snapshot_html) {
        throw new Error('Termo de entrega ainda não assinado ou cópia indisponível.');
      }
      return {
        filename: `termo-entrega-${installationLogId}.html`,
        html: acceptance.snapshot_html,
      };
    }

    throw new Error('Tipo de documento inválido.');
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

  async getStatus(userId) {
    const serviceAccepted = await this.contracts.hasServiceAcceptance(userId);
    return { service_accepted: serviceAccepted };
  }

  async listTemplatesAdmin() {
    return this.contracts.listTemplates();
  }

  async updateTemplateAdmin(slug, { title, body_html }) {
    if (!title && !body_html) {
      throw new Error('Informe título ou conteúdo para atualizar.');
    }
    const updated = await this.contracts.updateTemplate(slug, { title, body_html });
    if (!updated) throw new Error('Modelo de contrato não encontrado.');
    return updated;
  }

  async listAcceptancesAdmin(tenantId) {
    const rows = await this.contracts.listAllAcceptances({ tenantId });
    return rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      user_name: row.user_name,
      user_email: row.user_email,
      acceptance_type: row.acceptance_type,
      template_slug: row.template_slug,
      template_title: row.template_title,
      template_version: row.template_version,
      vehicle_plate: row.vehicle_plate,
      installation_log_id: row.installation_log_id,
      accepted_at: row.accepted_at,
      has_snapshot: Boolean(row.snapshot_html),
    }));
  }

  async getAcceptanceDocumentAdmin(acceptanceId) {
    const acceptance = await this.contracts.findAcceptanceById(acceptanceId);
    if (!acceptance?.snapshot_html) {
      throw new Error('Cópia do documento não disponível.');
    }
    const slug = acceptance.slug || acceptance.acceptance_type;
    return {
      filename: `contrato-${slug}-${acceptance.id}.html`,
      html: acceptance.snapshot_html,
    };
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
