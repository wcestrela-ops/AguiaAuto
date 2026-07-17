const { getTenantRepository } = require('../repositories/tenant-repository');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

class TenantBrandingService {
  constructor() {
    this.tenants = getTenantRepository();
  }

  formatBranding(tenant) {
    if (!tenant) return null;
    return {
      tenant_id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      trade_name: tenant.trade_name,
      brand_name: tenant.brand_name || tenant.trade_name || tenant.name,
      logo_url: tenant.logo_url || null,
      primary_color: tenant.primary_color || '#2563eb',
      favicon_url: tenant.favicon_url || null,
      custom_domain: tenant.custom_domain || null,
    };
  }

  async getBySlug(slug) {
    const tenant = await this.tenants.findBySlug(slug);
    return this.formatBranding(tenant);
  }

  async getById(tenantId = DEFAULT_TENANT_ID) {
    const tenant = await this.tenants.findById(tenantId);
    return this.formatBranding(tenant);
  }

  async updateBranding(tenantId, payload = {}) {
    const updates = {};
    if (payload.brand_name !== undefined) updates.brand_name = payload.brand_name?.trim() || null;
    if (payload.logo_url !== undefined) updates.logo_url = payload.logo_url?.trim() || null;
    if (payload.favicon_url !== undefined) updates.favicon_url = payload.favicon_url?.trim() || null;
    if (payload.custom_domain !== undefined) updates.custom_domain = payload.custom_domain?.trim() || null;
    if (payload.primary_color !== undefined) {
      const color = payload.primary_color?.trim();
      if (color && !HEX_COLOR.test(color)) {
        throw new Error('primary_color deve ser hex (#RRGGBB).');
      }
      updates.primary_color = color || null;
    }

    const tenant = await this.tenants.update(tenantId, updates);
    if (!tenant) throw new Error('Empresa não encontrada.');
    return this.formatBranding(tenant);
  }
}

let instance = null;

function getTenantBrandingService() {
  if (!instance) instance = new TenantBrandingService();
  return instance;
}

module.exports = { TenantBrandingService, getTenantBrandingService };
