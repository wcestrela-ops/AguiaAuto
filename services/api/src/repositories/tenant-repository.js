const { getPool } = require('../db/pool');
const { normalizeTenantId, DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

class TenantRepository {
  constructor() {
    this.pool = getPool();
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      `SELECT id, name, legal_name, trade_name, slug, document_type, document_number,
              email, phone, status, timezone, locale, currency, active,
              created_at, updated_at, deleted_at
       FROM tenants
       WHERE id = $1 AND deleted_at IS NULL`,
      [normalizeTenantId(id)],
    );
    return rows[0] || null;
  }

  async findBySlug(slug) {
    if (!slug) return null;
    const { rows } = await this.pool.query(
      `SELECT id, name, legal_name, trade_name, slug, status, active, timezone, locale, currency
       FROM tenants
       WHERE slug = $1 AND deleted_at IS NULL`,
      [String(slug).toLowerCase().trim()],
    );
    return rows[0] || null;
  }

  async isActive(id) {
    const tenant = await this.findById(id);
    if (!tenant) return false;
    if (tenant.active === false) return false;
    const status = String(tenant.status || 'ACTIVE').toUpperCase();
    return ['TRIAL', 'ACTIVE'].includes(status);
  }

  async ensureDefaultTenant() {
    const existing = await this.findById(DEFAULT_TENANT_ID);
    return existing;
  }
}

let instance = null;

function getTenantRepository() {
  if (!instance) instance = new TenantRepository();
  return instance;
}

module.exports = { TenantRepository, getTenantRepository };
