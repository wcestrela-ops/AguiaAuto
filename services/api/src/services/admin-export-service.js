const { getAdminClientService } = require('./admin-client-service');
const { getVehicleService } = require('./vehicle-service');
const { getFinanceiroService } = require('./financeiro-service');
const { getVehicleFleetService } = require('./vehicle-fleet-service');
const { getEmergencyService } = require('./emergency-service');
const { getAuditRepository } = require('../repositories/audit-repository');
const { getInvoiceRepository } = require('../repositories/invoice-repository');
const { getSmsService } = require('@aguia/sms');
const { buildExportBuffer } = require('../lib/export/table-export');
const { formatDateTimeBr, exportFilename } = require('../lib/export/formatters');
const {
  CLIENTES_COLUMNS,
  VEICULOS_COLUMNS,
  COBRANCAS_COLUMNS,
  FROTA_DOCS_COLUMNS,
  FROTA_MAINT_COLUMNS,
  EMERGENCIA_COLUMNS,
  SMS_COLUMNS,
  AUDIT_COLUMNS,
  CLIENTE_VEICULOS_COLUMNS,
  CLIENTE_FATURAS_COLUMNS,
  PROVISIONING_LABELS,
} = require('../lib/export/columns');

const EXPORT_LIMIT = 10000;

function parseFormat(value) {
  const format = String(value || 'xlsx').toLowerCase();
  if (!['xlsx', 'pdf'].includes(format)) {
    throw new Error('Formato inválido. Use xlsx ou pdf.');
  }
  return format;
}

function parseDateFilter(value, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

class AdminExportService {
  async build(resource, query = {}) {
    const format = parseFormat(query.format);
    const generatedAt = formatDateTimeBr(new Date());

    switch (resource) {
      case 'clientes':
        return this._exportClientes(format, query, generatedAt);
      case 'cliente':
        return this._exportClienteDetail(format, query, generatedAt);
      case 'veiculos':
        return this._exportVeiculos(format, generatedAt);
      case 'financeiro-cobrancas':
        return this._exportCobrancas(format, generatedAt);
      case 'frota-documentos':
        return this._exportFrotaDocumentos(format, generatedAt);
      case 'frota-manutencao':
        return this._exportFrotaManutencao(format, generatedAt);
      case 'emergencia':
        return this._exportEmergencia(format, generatedAt);
      case 'sms-dispatches':
        return this._exportSmsDispatches(format, query, generatedAt);
      case 'auditoria':
        return this._exportAuditoria(format, query, generatedAt);
      default:
        throw new Error('Recurso de exportação não encontrado.');
    }
  }

  async _exportClientes(format, query, generatedAt) {
    const data = await getAdminClientService().listClients({
      q: query.q,
      active: query.active,
      provisioning_status: query.provisioning_status,
      never_accessed: query.never_accessed,
      access_inactive_days: query.access_inactive_days,
      sort: query.sort,
      limit: EXPORT_LIMIT,
      offset: 0,
    });

    const buffer = await buildExportBuffer({
      format,
      title: 'Clientes',
      columns: CLIENTES_COLUMNS,
      rows: data.clients,
      generatedAt,
    });

    return { buffer, format, filename: exportFilename('clientes', format) };
  }

  async _exportClienteDetail(format, query, generatedAt) {
    const userId = query.user_id || query.id;
    if (!userId) throw new Error('user_id é obrigatório.');

    const detail = await getAdminClientService().getClientDetail(userId);
    const invoices = await getInvoiceRepository().listByUser(userId, { limit: EXPORT_LIMIT });
    const user = detail.user;

    const summaryColumns = [
      { header: 'Campo', value: (r) => r.label },
      { header: 'Valor', value: (r) => r.value },
    ];

    const summaryData = [
      { label: 'ID', value: String(user.id) },
      { label: 'Nome', value: user.name || '' },
      { label: 'E-mail', value: user.email || '' },
      { label: 'Telefone', value: user.phone || '' },
      { label: 'CPF/CNPJ', value: user.cpf_cnpj || '' },
      { label: 'Conta ativa', value: user.active ? 'Sim' : 'Não' },
      { label: 'Provisionamento', value: PROVISIONING_LABELS[user.provisioning_status] || user.provisioning_status || '' },
      { label: 'Último acesso', value: formatDateTimeBr(user.last_access_at) },
      { label: 'Situação financeira', value: detail.resumo_financeiro?.status || '' },
      { label: 'Faturas pendentes', value: String(detail.resumo_financeiro?.faturas_pendentes || 0) },
    ];

    const invoiceRows = invoices.map((inv) => ({
      description: inv.description,
      amount: Number(inv.amount),
      due_date: inv.due_date,
      status: inv.status,
      payment_provider: inv.payment_provider,
      paid_at: inv.paid_at,
    }));

    const buffer = await buildExportBuffer({
      format,
      title: `Cliente ${user.name || user.email}`,
      columns: summaryColumns,
      rows: summaryData,
      generatedAt,
      sheets: format === 'pdf' ? undefined : [
        { name: 'Resumo', columns: summaryColumns, rows: summaryData },
        { name: 'Veículos', columns: CLIENTE_VEICULOS_COLUMNS, rows: detail.veiculos },
        { name: 'Faturas', columns: CLIENTE_FATURAS_COLUMNS, rows: invoiceRows },
      ],
      sections: format === 'pdf' ? [
        { title: `Cliente — ${user.name || user.email}`, columns: summaryColumns, rows: summaryData },
        { title: 'Veículos', columns: CLIENTE_VEICULOS_COLUMNS, rows: detail.veiculos },
        { title: 'Faturas', columns: CLIENTE_FATURAS_COLUMNS, rows: invoiceRows },
      ] : undefined,
    });

    const slug = (user.name || user.email || user.id).toString().replace(/[^\w.-]+/g, '-').slice(0, 40);
    return { buffer, format, filename: exportFilename(`cliente-${slug}`, format) };
  }

  async _exportVeiculos(format, generatedAt) {
    const rows = await getVehicleService().listAll();
    const buffer = await buildExportBuffer({
      format,
      title: 'Veículos e dispositivos',
      columns: VEICULOS_COLUMNS,
      rows,
      generatedAt,
    });
    return { buffer, format, filename: exportFilename('veiculos-dispositivos', format) };
  }

  async _exportCobrancas(format, generatedAt) {
    const rows = await getFinanceiroService().listAllCharges({ limit: EXPORT_LIMIT });
    const buffer = await buildExportBuffer({
      format,
      title: 'Cobranças',
      columns: COBRANCAS_COLUMNS,
      rows,
      generatedAt,
    });
    return { buffer, format, filename: exportFilename('financeiro-cobrancas', format) };
  }

  async _exportFrotaDocumentos(format, generatedAt) {
    const rows = await getVehicleFleetService().adminListDocuments();
    const buffer = await buildExportBuffer({
      format,
      title: 'Documentos de frota',
      columns: FROTA_DOCS_COLUMNS,
      rows,
      generatedAt,
    });
    return { buffer, format, filename: exportFilename('frota-documentos', format) };
  }

  async _exportFrotaManutencao(format, generatedAt) {
    const rows = await getVehicleFleetService().adminListMaintenance();
    const buffer = await buildExportBuffer({
      format,
      title: 'Manutenções',
      columns: FROTA_MAINT_COLUMNS,
      rows,
      generatedAt,
    });
    return { buffer, format, filename: exportFilename('frota-manutencao', format) };
  }

  async _exportEmergencia(format, generatedAt) {
    const rows = await getEmergencyService().listRecentEvents(EXPORT_LIMIT);
    const buffer = await buildExportBuffer({
      format,
      title: 'Emergências SOS',
      columns: EMERGENCIA_COLUMNS,
      rows,
      generatedAt,
    });
    return { buffer, format, filename: exportFilename('emergencia-sos', format) };
  }

  async _exportSmsDispatches(format, query, generatedAt) {
    const rows = await getSmsService().listDispatches({
      limit: Math.min(parseInt(query.limit || String(EXPORT_LIMIT), 10), EXPORT_LIMIT),
      vehicleId: query.vehicle_id ? parseInt(query.vehicle_id, 10) : undefined,
      action: query.action || undefined,
    });
    const buffer = await buildExportBuffer({
      format,
      title: 'Envios SMS',
      columns: SMS_COLUMNS,
      rows,
      generatedAt,
    });
    return { buffer, format, filename: exportFilename('sms-envios', format) };
  }

  async _exportAuditoria(format, query, generatedAt) {
    const filters = {
      limit: EXPORT_LIMIT,
      offset: 0,
      action: query.action || undefined,
      actor_type: query.actor_type || undefined,
      resource_type: query.resource_type || undefined,
      actor_id: query.actor_id || undefined,
      resource_id: query.resource_id || undefined,
      search: query.search?.trim() || undefined,
      from: parseDateFilter(query.from),
      to: parseDateFilter(query.to, true),
    };

    const rows = await getAuditRepository().list(filters);
    const buffer = await buildExportBuffer({
      format,
      title: 'Auditoria',
      columns: AUDIT_COLUMNS,
      rows,
      generatedAt,
    });
    return { buffer, format, filename: exportFilename('auditoria', format) };
  }
}

let instance = null;

function getAdminExportService() {
  if (!instance) instance = new AdminExportService();
  return instance;
}

module.exports = { AdminExportService, getAdminExportService, EXPORT_LIMIT };
