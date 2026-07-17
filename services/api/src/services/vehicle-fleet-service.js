const { getVehicleRepository } = require('../repositories/vehicle-repository');
const { getVehicleDocumentRepository } = require('../repositories/vehicle-document-repository');
const { getVehicleMaintenanceRepository } = require('../repositories/vehicle-maintenance-repository');
const {
  DOC_TYPES,
  MAINTENANCE_TYPES,
  docTypeLabel,
  maintenanceTypeLabel,
} = require('../lib/fleet-constants');
const { resolveUploadPath } = require('../lib/upload');

const EXPIRY_WARNING_DAYS = 30;

function formatDateBr(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-BR');
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function expiryStatus(expiryDate) {
  const days = daysUntil(expiryDate);
  if (days == null) return 'sem_vencimento';
  if (days < 0) return 'vencido';
  if (days <= EXPIRY_WARNING_DAYS) return 'vencendo';
  return 'ok';
}

function formatDocument(row) {
  if (!row) return null;
  const status = expiryStatus(row.expiry_date);
  return {
    id: row.id,
    vehicle_id: row.vehicle_id,
    user_id: row.user_id,
    doc_type: row.doc_type,
    doc_type_label: docTypeLabel(row.doc_type),
    title: row.title,
    expiry_date: row.expiry_date,
    expiry_date_br: formatDateBr(row.expiry_date),
    expiry_status: status,
    days_until_expiry: daysUntil(row.expiry_date),
    notes: row.notes,
    has_file: Boolean(row.file_path),
    original_filename: row.original_filename,
    plate: row.plate || null,
    brand: row.brand || null,
    model: row.model || null,
    user_name: row.user_name || null,
    user_email: row.user_email || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function formatMaintenance(row) {
  if (!row) return null;
  const dueStatus = expiryStatus(row.next_due_date);
  return {
    id: row.id,
    vehicle_id: row.vehicle_id,
    user_id: row.user_id,
    service_type: row.service_type,
    service_type_label: maintenanceTypeLabel(row.service_type),
    title: row.title,
    performed_at: row.performed_at,
    performed_at_br: formatDateBr(row.performed_at),
    odometer_km: row.odometer_km,
    cost: row.cost != null ? Number(row.cost) : null,
    next_due_date: row.next_due_date,
    next_due_date_br: formatDateBr(row.next_due_date),
    next_due_km: row.next_due_km,
    due_status: dueStatus,
    days_until_due: daysUntil(row.next_due_date),
    notes: row.notes,
    plate: row.plate || null,
    brand: row.brand || null,
    model: row.model || null,
    user_name: row.user_name || null,
    user_email: row.user_email || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function vehicleLabel(row) {
  return [row?.brand, row?.model, row?.plate].filter(Boolean).join(' · ') || row?.plate || 'Veículo';
}

class VehicleFleetService {
  constructor() {
    this.vehicles = getVehicleRepository();
    this.documents = getVehicleDocumentRepository();
    this.maintenance = getVehicleMaintenanceRepository();
  }

  async _requireVehicleForUser(vehicleId, userId) {
    const vehicle = await this.vehicles.findByIdForUser(vehicleId, userId);
    if (!vehicle) throw new Error('Veículo não encontrado.');
    return vehicle;
  }

  async _requireVehicle(vehicleId, tenantId) {
    const vehicle = await this.vehicles.findById(vehicleId, tenantId);
    if (!vehicle) throw new Error('Veículo não encontrado.');
    return vehicle;
  }

  getMetadata() {
    return {
      doc_types: Object.entries(DOC_TYPES).map(([key, label]) => ({ key, label })),
      maintenance_types: Object.entries(MAINTENANCE_TYPES).map(([key, label]) => ({ key, label })),
      expiry_warning_days: EXPIRY_WARNING_DAYS,
    };
  }

  async getOverview(userId) {
    const [documents, maintenance, vehicles] = await Promise.all([
      this.documents.listByUser(userId),
      this.maintenance.listByUser(userId),
      this.vehicles.listByUser(userId),
    ]);

    const docsFormatted = documents.map(formatDocument);
    const maintFormatted = maintenance.map(formatMaintenance);

    return {
      veiculos: vehicles.map((v) => ({
        id: v.id,
        label: vehicleLabel(v),
        plate: v.plate,
      })),
      documentos: docsFormatted,
      manutencoes: maintFormatted,
      resumo: {
        documentos_total: docsFormatted.length,
        documentos_vencendo: docsFormatted.filter((d) => d.expiry_status === 'vencendo').length,
        documentos_vencidos: docsFormatted.filter((d) => d.expiry_status === 'vencido').length,
        manutencoes_total: maintFormatted.length,
        manutencoes_proximas: maintFormatted.filter((m) => m.due_status === 'vencendo').length,
        manutencoes_atrasadas: maintFormatted.filter((m) => m.due_status === 'vencido').length,
      },
      ...this.getMetadata(),
    };
  }

  async listDocumentsForUser(userId) {
    const rows = await this.documents.listByUser(userId);
    return rows.map(formatDocument);
  }

  async listDocumentsForVehicle(userId, vehicleId) {
    await this._requireVehicleForUser(vehicleId, userId);
    const rows = await this.documents.listByVehicle(vehicleId);
    return rows.map(formatDocument);
  }

  async createDocument(userId, vehicleId, data, fileMeta = null) {
    await this._requireVehicleForUser(vehicleId, userId);
    if (!data.title?.trim()) throw new Error('Título do documento é obrigatório.');

    const row = await this.documents.create({
      vehicle_id: vehicleId,
      user_id: userId,
      doc_type: data.doc_type,
      title: data.title.trim(),
      expiry_date: data.expiry_date || null,
      notes: data.notes || null,
      file_path: fileMeta?.file_path || null,
      original_filename: fileMeta?.original_filename || null,
    });
    return formatDocument(row);
  }

  async updateDocument(userId, documentId, data, fileMeta = null) {
    const existing = await this.documents.findByIdForUser(documentId, userId);
    if (!existing) throw new Error('Documento não encontrado.');

    const row = await this.documents.update(documentId, {
      doc_type: data.doc_type,
      title: data.title?.trim(),
      expiry_date: data.expiry_date,
      notes: data.notes,
      file_path: fileMeta?.file_path,
      original_filename: fileMeta?.original_filename,
    });
    return formatDocument(row);
  }

  async deleteDocument(userId, documentId) {
    const existing = await this.documents.findByIdForUser(documentId, userId);
    if (!existing) throw new Error('Documento não encontrado.');
    await this.documents.delete(documentId);
    return { deleted: true };
  }

  async getDocumentFile(userId, documentId) {
    const doc = await this.documents.findByIdForUser(documentId, userId);
    if (!doc?.file_path) throw new Error('Arquivo não disponível.');
    return {
      path: resolveUploadPath(doc.file_path),
      filename: doc.original_filename || `documento-${doc.id}`,
    };
  }

  async listMaintenanceForUser(userId) {
    const rows = await this.maintenance.listByUser(userId);
    return rows.map(formatMaintenance);
  }

  async listMaintenanceForVehicle(userId, vehicleId) {
    await this._requireVehicleForUser(vehicleId, userId);
    const rows = await this.maintenance.listByVehicle(vehicleId);
    return rows.map(formatMaintenance);
  }

  async createMaintenance(userId, vehicleId, data) {
    await this._requireVehicleForUser(vehicleId, userId);
    if (!data.title?.trim()) throw new Error('Título da manutenção é obrigatório.');
    if (!data.performed_at) throw new Error('Data da manutenção é obrigatória.');

    const row = await this.maintenance.create({
      vehicle_id: vehicleId,
      user_id: userId,
      service_type: data.service_type,
      title: data.title.trim(),
      performed_at: data.performed_at,
      odometer_km: data.odometer_km != null ? parseInt(data.odometer_km, 10) : null,
      cost: data.cost != null ? Number(data.cost) : null,
      next_due_date: data.next_due_date || null,
      next_due_km: data.next_due_km != null ? parseInt(data.next_due_km, 10) : null,
      notes: data.notes || null,
    });
    return formatMaintenance(row);
  }

  async updateMaintenance(userId, recordId, data) {
    const existing = await this.maintenance.findByIdForUser(recordId, userId);
    if (!existing) throw new Error('Registro de manutenção não encontrado.');

    const row = await this.maintenance.update(recordId, {
      service_type: data.service_type,
      title: data.title?.trim(),
      performed_at: data.performed_at,
      odometer_km: data.odometer_km != null ? parseInt(data.odometer_km, 10) : undefined,
      cost: data.cost != null ? Number(data.cost) : undefined,
      next_due_date: data.next_due_date,
      next_due_km: data.next_due_km != null ? parseInt(data.next_due_km, 10) : undefined,
      notes: data.notes,
    });
    return formatMaintenance(row);
  }

  async deleteMaintenance(userId, recordId) {
    const existing = await this.maintenance.findByIdForUser(recordId, userId);
    if (!existing) throw new Error('Registro de manutenção não encontrado.');
    await this.maintenance.delete(recordId);
    return { deleted: true };
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  async adminListDocuments(tenantId) {
    const rows = await this.documents.listAll({ tenantId });
    return rows.map(formatDocument);
  }

  async adminCreateDocument({ vehicle_id, user_id, ...data }, fileMeta = null, tenantId) {
    const vehicle = await this._requireVehicle(vehicle_id, tenantId);
    const ownerId = user_id || vehicle.user_id;

    const row = await this.documents.create({
      vehicle_id,
      user_id: ownerId,
      tenant_id: tenantId,
      doc_type: data.doc_type,
      title: data.title.trim(),
      expiry_date: data.expiry_date || null,
      notes: data.notes || null,
      file_path: fileMeta?.file_path || null,
      original_filename: fileMeta?.original_filename || null,
    }, tenantId);
    return formatDocument(row);
  }

  async adminUpdateDocument(documentId, data, fileMeta = null, tenantId) {
    const existing = await this.documents.findById(documentId, tenantId);
    if (!existing) throw new Error('Documento não encontrado.');

    const row = await this.documents.update(documentId, {
      doc_type: data.doc_type,
      title: data.title?.trim(),
      expiry_date: data.expiry_date,
      notes: data.notes,
      file_path: fileMeta?.file_path,
      original_filename: fileMeta?.original_filename,
    }, tenantId);
    return formatDocument(row);
  }

  async adminDeleteDocument(documentId, tenantId) {
    const existing = await this.documents.findById(documentId, tenantId);
    if (!existing) throw new Error('Documento não encontrado.');
    await this.documents.delete(documentId, tenantId);
    return formatDocument(existing);
  }

  async adminGetDocumentFile(documentId, tenantId) {
    const doc = await this.documents.findById(documentId, tenantId);
    if (!doc?.file_path) throw new Error('Arquivo não disponível.');
    return {
      path: resolveUploadPath(doc.file_path),
      filename: doc.original_filename || `documento-${doc.id}`,
    };
  }

  async adminListMaintenance(tenantId) {
    const rows = await this.maintenance.listAll({ tenantId });
    return rows.map(formatMaintenance);
  }

  async adminCreateMaintenance({ vehicle_id, user_id, ...data }, tenantId) {
    const vehicle = await this._requireVehicle(vehicle_id, tenantId);
    const ownerId = user_id || vehicle.user_id;

    const row = await this.maintenance.create({
      vehicle_id,
      user_id: ownerId,
      tenant_id: tenantId,
      service_type: data.service_type,
      title: data.title.trim(),
      performed_at: data.performed_at,
      odometer_km: data.odometer_km != null ? parseInt(data.odometer_km, 10) : null,
      cost: data.cost != null ? Number(data.cost) : null,
      next_due_date: data.next_due_date || null,
      next_due_km: data.next_due_km != null ? parseInt(data.next_due_km, 10) : null,
      notes: data.notes || null,
    }, tenantId);
    return formatMaintenance(row);
  }

  async adminUpdateMaintenance(recordId, data, tenantId) {
    const existing = await this.maintenance.findById(recordId, tenantId);
    if (!existing) throw new Error('Registro de manutenção não encontrado.');

    const row = await this.maintenance.update(recordId, {
      service_type: data.service_type,
      title: data.title?.trim(),
      performed_at: data.performed_at,
      odometer_km: data.odometer_km != null ? parseInt(data.odometer_km, 10) : undefined,
      cost: data.cost != null ? Number(data.cost) : undefined,
      next_due_date: data.next_due_date,
      next_due_km: data.next_due_km != null ? parseInt(data.next_due_km, 10) : undefined,
      notes: data.notes,
    }, tenantId);
    return formatMaintenance(row);
  }

  async adminDeleteMaintenance(recordId, tenantId) {
    const existing = await this.maintenance.findById(recordId, tenantId);
    if (!existing) throw new Error('Registro de manutenção não encontrado.');
    await this.maintenance.delete(recordId, tenantId);
    return formatMaintenance(existing);
  }

  async getOperationalSummary() {
    const [expiringDocs, dueMaintenance, expiredDocs, overdueMaintenance] = await Promise.all([
      this.documents.countExpiringWithinDays(EXPIRY_WARNING_DAYS),
      this.maintenance.countDueWithinDays(EXPIRY_WARNING_DAYS),
      this.documents.listExpiringWithinDays(EXPIRY_WARNING_DAYS, { limit: 10 }),
      this.maintenance.listDueWithinDays(EXPIRY_WARNING_DAYS, { limit: 10 }),
    ]);

    const expiredCount = expiredDocs.filter((d) => expiryStatus(d.expiry_date) === 'vencido').length;
    const overdueCount = overdueMaintenance.filter((m) => expiryStatus(m.next_due_date) === 'vencido').length;

    return {
      documents_expiring: expiringDocs,
      documents_expired: expiredCount,
      maintenance_due: dueMaintenance,
      maintenance_overdue: overdueCount,
      recent_expiring_documents: expiredDocs.map(formatDocument),
      recent_due_maintenance: overdueMaintenance.map(formatMaintenance),
    };
  }
}

let instance = null;

function getVehicleFleetService() {
  if (!instance) instance = new VehicleFleetService();
  return instance;
}

module.exports = {
  VehicleFleetService,
  getVehicleFleetService,
  formatDocument,
  formatMaintenance,
  expiryStatus,
  EXPIRY_WARNING_DAYS,
};
