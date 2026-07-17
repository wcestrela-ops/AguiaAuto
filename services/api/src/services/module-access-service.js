const { getModuleRepository } = require('../repositories/module-repository');
const { isMultiTenantEnabled } = require('../lib/tenant/tenant-config');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

const MODULE_DEPENDENCIES = {
  TRACKING: ['CORE_VEHICLES'],
  BILLING_AUTOMATION: ['FINANCE'],
  CRM: ['CORE_CUSTOMERS'],
  TELEMETRY: ['TRACKING'],
  REPORTS: ['CORE_CUSTOMERS'],
  SERVICE_ORDERS: ['CORE_VEHICLES'],
  INSTALLATIONS: ['CORE_VEHICLES'],
};

class ModuleAccessService {
  constructor() {
    this.modules = getModuleRepository();
  }

  async isActive(tenantId = DEFAULT_TENANT_ID, moduleCode) {
    if (!isMultiTenantEnabled()) return true;
    if (!moduleCode) return true;

    const code = String(moduleCode).toUpperCase();
    const mod = await this.modules.findByCode(code);
    if (mod?.is_core) return true;

    return this.modules.isModuleActiveForTenant(tenantId, code);
  }

  async assertActive(tenantId, moduleCode) {
    const active = await this.isActive(tenantId, moduleCode);
    if (!active) {
      const err = new Error(`Módulo "${moduleCode}" não está ativo para esta empresa.`);
      err.code = 'MODULE_NOT_ACTIVE';
      err.statusCode = 403;
      throw err;
    }
  }

  async getActiveModules(tenantId = DEFAULT_TENANT_ID) {
    if (!isMultiTenantEnabled()) {
      const catalog = await this.modules.listCatalog();
      return catalog.map((m) => ({ code: m.code, name: m.name, status: 'ACTIVE' }));
    }
    return this.modules.listActiveForTenant(tenantId);
  }

  async checkDependencies(tenantId, moduleCode) {
    const deps = MODULE_DEPENDENCIES[String(moduleCode).toUpperCase()] || [];
    for (const dep of deps) {
      const ok = await this.isActive(tenantId, dep);
      if (!ok) {
        return { ok: false, missing: dep };
      }
    }
    return { ok: true };
  }
}

let instance = null;

function getModuleAccessService() {
  if (!instance) instance = new ModuleAccessService();
  return instance;
}

module.exports = { ModuleAccessService, getModuleAccessService, MODULE_DEPENDENCIES };
