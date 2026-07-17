const { getCrmLeadRepository } = require('../repositories/crm-lead-repository');
const { getModuleAccessService } = require('./module-access-service');
const { LEAD_STATUSES } = require('../db/migrate-phase15-crm-leads');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class CrmLeadService {
  constructor() {
    this.leads = getCrmLeadRepository();
  }

  validateStatus(status) {
    if (!status) return 'NEW';
    const normalized = String(status).toUpperCase();
    if (!LEAD_STATUSES.includes(normalized)) {
      throw Object.assign(new Error(`Status inválido. Use: ${LEAD_STATUSES.join(', ')}.`), { statusCode: 400 });
    }
    return normalized;
  }

  async assertCrmModule(tenantId) {
    await getModuleAccessService().assertActive(tenantId, 'CRM');
  }

  async listLeads(tenantId, filters = {}) {
    await this.assertCrmModule(tenantId);
    return this.leads.listAll(tenantId, filters);
  }

  async getLead(tenantId, id) {
    await this.assertCrmModule(tenantId);
    const lead = await this.leads.findById(id, tenantId);
    if (!lead) throw Object.assign(new Error('Lead não encontrado.'), { statusCode: 404 });
    return lead;
  }

  async createLead(tenantId, payload = {}) {
    await this.assertCrmModule(tenantId);
    const name = payload.name?.trim();
    if (!name) throw Object.assign(new Error('Nome é obrigatório.'), { statusCode: 400 });
    if (payload.email && !EMAIL_RE.test(payload.email)) {
      throw Object.assign(new Error('E-mail inválido.'), { statusCode: 400 });
    }
    return this.leads.create({
      name,
      email: payload.email?.trim() || null,
      phone: payload.phone?.trim() || null,
      source: payload.source?.trim() || 'admin',
      status: this.validateStatus(payload.status),
      notes: payload.notes?.trim() || null,
      assigned_admin_id: payload.assigned_admin_id || null,
      metadata: payload.metadata || {},
    }, tenantId);
  }

  async createPublicLead(tenantId, payload = {}, context = {}) {
    await this.assertCrmModule(tenantId);
    const name = payload.name?.trim();
    if (!name) throw Object.assign(new Error('Nome é obrigatório.'), { statusCode: 400 });
    if (payload.email && !EMAIL_RE.test(payload.email)) {
      throw Object.assign(new Error('E-mail inválido.'), { statusCode: 400 });
    }
    return this.leads.create({
      name,
      email: payload.email?.trim() || null,
      phone: payload.phone?.trim() || null,
      source: payload.source?.trim() || 'landing',
      status: 'NEW',
      notes: payload.message?.trim() || payload.notes?.trim() || null,
      metadata: {
        host: context.host || null,
        page: payload.page || null,
        utm: payload.utm || null,
      },
    }, tenantId);
  }

  async updateLead(tenantId, id, payload = {}) {
    await this.assertCrmModule(tenantId);
    if (payload.status) payload.status = this.validateStatus(payload.status);
    if (payload.email && !EMAIL_RE.test(payload.email)) {
      throw Object.assign(new Error('E-mail inválido.'), { statusCode: 400 });
    }
    const lead = await this.leads.update(id, payload, tenantId);
    if (!lead) throw Object.assign(new Error('Lead não encontrado.'), { statusCode: 404 });
    return lead;
  }

  async deleteLead(tenantId, id) {
    await this.assertCrmModule(tenantId);
    const ok = await this.leads.delete(id, tenantId);
    if (!ok) throw Object.assign(new Error('Lead não encontrado.'), { statusCode: 404 });
    return { deleted: true };
  }
}

let instance = null;

function getCrmLeadService() {
  if (!instance) instance = new CrmLeadService();
  return instance;
}

module.exports = { CrmLeadService, getCrmLeadService, LEAD_STATUSES };
