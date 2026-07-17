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
              brand_name, logo_url, primary_color, favicon_url, custom_domain,
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
      `SELECT id, name, legal_name, trade_name, slug, status, active, timezone, locale, currency,
              brand_name, logo_url, primary_color, favicon_url, custom_domain
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

  async listAll(limit = 50) {
    const { rows } = await this.pool.query(
      `SELECT id, name, legal_name, trade_name, slug, email, phone, status, active,
              timezone, locale, currency, created_at, updated_at
       FROM tenants
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.min(Math.max(limit, 1), 200)],
    );
    return rows;
  }

  async create(data) {
    const slug = String(data.slug || data.trade_name || data.name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `tenant-${Date.now()}`;

    const { rows } = await this.pool.query(
      `INSERT INTO tenants (
        name, legal_name, trade_name, slug, document_type, document_number,
        email, phone, status, timezone, locale, currency, active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)
      RETURNING *`,
      [
        data.name || data.trade_name || slug,
        data.legal_name || null,
        data.trade_name || data.name || slug,
        slug,
        data.document_type || null,
        data.document_number || null,
        data.email || null,
        data.phone || null,
        data.status || 'TRIAL',
        data.timezone || 'America/Sao_Paulo',
        data.locale || 'pt-BR',
        data.currency || 'BRL',
      ],
    );
    return rows[0];
  }

  async update(id, data) {
    const { rows } = await this.pool.query(
      `UPDATE tenants SET
        name = COALESCE($2, name),
        legal_name = COALESCE($3, legal_name),
        trade_name = COALESCE($4, trade_name),
        slug = COALESCE($5, slug),
        email = COALESCE($6, email),
        phone = COALESCE($7, phone),
        status = COALESCE($8, status),
        active = COALESCE($9, active),
        timezone = COALESCE($10, timezone),
        locale = COALESCE($11, locale),
        currency = COALESCE($12, currency),
        brand_name = COALESCE($13, brand_name),
        logo_url = COALESCE($14, logo_url),
        primary_color = COALESCE($15, primary_color),
        favicon_url = COALESCE($16, favicon_url),
        custom_domain = COALESCE($17, custom_domain),
        updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [
        normalizeTenantId(id),
        data.name,
        data.legal_name,
        data.trade_name,
        data.slug,
        data.email,
        data.phone,
        data.status,
        data.active,
        data.timezone,
        data.locale,
        data.currency,
        data.brand_name,
        data.logo_url,
        data.primary_color,
        data.favicon_url,
        data.custom_domain,
      ],
    );
    return rows[0] || null;
  }
}

let instance = null;

function getTenantRepository() {
  if (!instance) instance = new TenantRepository();
  return instance;
}

module.exports = { TenantRepository, getTenantRepository };
