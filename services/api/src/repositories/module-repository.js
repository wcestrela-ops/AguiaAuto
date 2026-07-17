const { getPool } = require('../db/pool');

class ModuleRepository {
  constructor() {
    this.pool = getPool();
  }

  async listCatalog({ publicOnly = false } = {}) {
    const { rows } = await this.pool.query(
      `SELECT id, code, name, description, category, icon, status, is_core, is_public, configuration_schema
       FROM modules
       WHERE status = 'ACTIVE' ${publicOnly ? 'AND is_public = true' : ''}
       ORDER BY category, name`,
    );
    return rows;
  }

  async findByCode(code) {
    const { rows } = await this.pool.query(
      'SELECT * FROM modules WHERE code = $1',
      [String(code).toUpperCase()],
    );
    return rows[0] || null;
  }

  async listActiveForTenant(tenantId) {
    const { rows } = await this.pool.query(
      `SELECT m.code, m.name, m.category, m.is_core, tm.status, tm.source,
              tm.starts_at, tm.trial_ends_at, tm.expires_at, tm.configuration
       FROM tenant_modules tm
       JOIN modules m ON m.id = tm.module_id
       WHERE tm.tenant_id = $1
         AND tm.status IN ('TRIAL', 'ACTIVE')
         AND m.status = 'ACTIVE'
         AND (tm.expires_at IS NULL OR tm.expires_at > NOW())
       ORDER BY m.category, m.name`,
      [tenantId],
    );
    return rows;
  }

  async isModuleActiveForTenant(tenantId, moduleCode) {
    const { rows } = await this.pool.query(
      `SELECT 1
       FROM tenant_modules tm
       JOIN modules m ON m.id = tm.module_id
       WHERE tm.tenant_id = $1
         AND m.code = $2
         AND tm.status IN ('TRIAL', 'ACTIVE')
         AND m.status = 'ACTIVE'
         AND (tm.expires_at IS NULL OR tm.expires_at > NOW())
       LIMIT 1`,
      [tenantId, String(moduleCode).toUpperCase()],
    );
    return rows.length > 0;
  }

  async activateModuleForTenant(tenantId, moduleCode, { source = 'MANUAL', status = 'ACTIVE' } = {}) {
    const mod = await this.findByCode(moduleCode);
    if (!mod) throw new Error(`Módulo "${moduleCode}" não encontrado.`);

    const { rows } = await this.pool.query(
      `INSERT INTO tenant_modules (tenant_id, module_id, status, source)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, module_id) DO UPDATE SET
         status = EXCLUDED.status,
         source = EXCLUDED.source,
         updated_at = NOW()
       RETURNING *`,
      [tenantId, mod.id, status, source],
    );
    return rows[0];
  }

  async suspendModuleForTenant(tenantId, moduleCode) {
    const mod = await this.findByCode(moduleCode);
    if (!mod) throw new Error(`Módulo "${moduleCode}" não encontrado.`);

    const { rows } = await this.pool.query(
      `UPDATE tenant_modules SET status = 'SUSPENDED', updated_at = NOW()
       WHERE tenant_id = $1 AND module_id = $2
       RETURNING *`,
      [tenantId, mod.id],
    );
    return rows[0] || null;
  }

  async listTenantModulesAdmin(tenantId) {
    const { rows } = await this.pool.query(
      `SELECT m.code, m.name, m.category, tm.status, tm.source, tm.starts_at, tm.expires_at
       FROM modules m
       LEFT JOIN tenant_modules tm ON tm.module_id = m.id AND tm.tenant_id = $1
       ORDER BY m.category, m.name`,
      [tenantId],
    );
    return rows;
  }
}

let instance = null;

function getModuleRepository() {
  if (!instance) instance = new ModuleRepository();
  return instance;
}

module.exports = { ModuleRepository, getModuleRepository };
