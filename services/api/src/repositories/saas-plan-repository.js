const { getPool } = require('../db/pool');

class SaasPlanRepository {
  constructor() {
    this.pool = getPool();
  }

  async list({ status = 'ACTIVE' } = {}) {
    const { rows } = await this.pool.query(
      `SELECT sp.*,
              (SELECT COUNT(*)::int FROM saas_plan_modules spm WHERE spm.plan_id = sp.id AND spm.included = true) AS modules_count
       FROM saas_plans sp
       WHERE ($1::text IS NULL OR sp.status = $1)
       ORDER BY sp.price_monthly ASC, sp.name ASC`,
      [status || null],
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await this.pool.query('SELECT * FROM saas_plans WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByCode(code) {
    const { rows } = await this.pool.query('SELECT * FROM saas_plans WHERE code = $1', [String(code).toLowerCase()]);
    return rows[0] || null;
  }

  async create(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO saas_plans (
        code, name, description, status, billing_cycle, trial_days,
        price_monthly, price_quarterly, price_semiannual, price_annual, currency
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        String(data.code).toLowerCase(),
        data.name,
        data.description || null,
        data.status || 'ACTIVE',
        data.billing_cycle || 'MONTHLY',
        data.trial_days ?? 14,
        data.price_monthly ?? 0,
        data.price_quarterly ?? null,
        data.price_semiannual ?? null,
        data.price_annual ?? null,
        data.currency || 'BRL',
      ],
    );
    return rows[0];
  }

  async update(id, data) {
    const { rows } = await this.pool.query(
      `UPDATE saas_plans SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        status = COALESCE($4, status),
        billing_cycle = COALESCE($5, billing_cycle),
        trial_days = COALESCE($6, trial_days),
        price_monthly = COALESCE($7, price_monthly),
        price_quarterly = COALESCE($8, price_quarterly),
        price_semiannual = COALESCE($9, price_semiannual),
        price_annual = COALESCE($10, price_annual),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id, data.name, data.description, data.status, data.billing_cycle, data.trial_days,
        data.price_monthly, data.price_quarterly, data.price_semiannual, data.price_annual,
      ],
    );
    return rows[0] || null;
  }

  async listModules(planId) {
    const { rows } = await this.pool.query(
      `SELECT m.code, m.name, m.category, spm.included, spm.limits
       FROM saas_plan_modules spm
       JOIN modules m ON m.id = spm.module_id
       WHERE spm.plan_id = $1
       ORDER BY m.category, m.name`,
      [planId],
    );
    return rows;
  }

  async setPlanModules(planId, moduleCodes = []) {
    await this.pool.query('DELETE FROM saas_plan_modules WHERE plan_id = $1', [planId]);
    for (const code of moduleCodes) {
      await this.pool.query(
        `INSERT INTO saas_plan_modules (plan_id, module_id, included)
         SELECT $1, m.id, true FROM modules m WHERE m.code = $2
         ON CONFLICT DO NOTHING`,
        [planId, String(code).toUpperCase()],
      );
    }
    return this.listModules(planId);
  }

  async listModulePrices(moduleId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM module_prices WHERE module_id = $1 AND active = true ORDER BY billing_cycle`,
      [moduleId],
    );
    return rows;
  }

  async upsertModulePrice(moduleId, data) {
    const { rows } = await this.pool.query(
      `INSERT INTO module_prices (module_id, billing_cycle, pricing_model, amount, currency, per_unit_label, active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (module_id, billing_cycle, pricing_model) DO UPDATE SET
         amount = EXCLUDED.amount,
         per_unit_label = EXCLUDED.per_unit_label,
         active = true,
         updated_at = NOW()
       RETURNING *`,
      [
        moduleId,
        data.billing_cycle || 'MONTHLY',
        data.pricing_model || 'FIXED',
        data.amount ?? 0,
        data.currency || 'BRL',
        data.per_unit_label || null,
      ],
    );
    return rows[0];
  }
}

let instance = null;

function getSaasPlanRepository() {
  if (!instance) instance = new SaasPlanRepository();
  return instance;
}

module.exports = { SaasPlanRepository, getSaasPlanRepository };
