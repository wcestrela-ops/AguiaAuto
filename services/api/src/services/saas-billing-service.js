const { getSaasPlanRepository } = require('../repositories/saas-plan-repository');
const {
  getTenantSaasSubscriptionRepository,
  ACTIVE_STATUSES,
} = require('../repositories/tenant-saas-subscription-repository');
const { getModuleRepository } = require('../repositories/module-repository');
const { getUsageLimitRepository } = require('../repositories/usage-limit-repository');
const { isMultiTenantEnabled, DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const { DEFAULT_USAGE_LIMITS } = require('../db/migrate-phase4-saas-billing');

class SaasBillingService {
  constructor() {
    this.plans = getSaasPlanRepository();
    this.subscriptions = getTenantSaasSubscriptionRepository();
    this.modules = getModuleRepository();
    this.usageLimits = getUsageLimitRepository();
  }

  async listPlans(options) {
    return this.plans.list(options);
  }

  async getPlan(id) {
    const plan = await this.plans.findById(id);
    if (!plan) return null;
    const modules = await this.plans.listModules(plan.id);
    return { ...plan, modules };
  }

  async getPlanByCode(code) {
    const plan = await this.plans.findByCode(code);
    if (!plan) return null;
    const modules = await this.plans.listModules(plan.id);
    return { ...plan, modules };
  }

  async createPlan(data) {
    const plan = await this.plans.create(data);
    if (Array.isArray(data.module_codes) && data.module_codes.length) {
      await this.plans.setPlanModules(plan.id, data.module_codes);
    }
    return this.getPlan(plan.id);
  }

  async updatePlan(id, data) {
    const plan = await this.plans.update(id, data);
    if (!plan) return null;
    if (Array.isArray(data.module_codes)) {
      await this.plans.setPlanModules(plan.id, data.module_codes);
    }
    return this.getPlan(plan.id);
  }

  async setPlanModules(planId, moduleCodes) {
    const modules = await this.plans.setPlanModules(planId, moduleCodes);
    return modules;
  }

  async isSubscriptionActive(tenantId = DEFAULT_TENANT_ID) {
    if (!isMultiTenantEnabled()) return true;
    const sub = await this.subscriptions.findActiveByTenant(tenantId);
    return Boolean(sub);
  }

  async assertSubscriptionActive(tenantId) {
    const active = await this.isSubscriptionActive(tenantId);
    if (!active) {
      const err = new Error('Assinatura SaaS inativa ou expirada para esta empresa.');
      err.code = 'SAAS_SUBSCRIPTION_INACTIVE';
      err.statusCode = 403;
      throw err;
    }
  }

  async getTenantSubscription(tenantId = DEFAULT_TENANT_ID) {
    const sub = await this.subscriptions.findActiveByTenant(tenantId);
    if (!sub) return null;
    const plan = sub.plan_id ? await this.getPlan(sub.plan_id) : null;
    return { subscription: sub, plan };
  }

  async listTenantSubscriptions(tenantId) {
    return this.subscriptions.listByTenant(tenantId);
  }

  async assignPlanToTenant(tenantId, planId, options = {}) {
    const plan = await this.plans.findById(planId);
    if (!plan) throw new Error('Plano SaaS não encontrado.');

    const subscription = await this.subscriptions.create({
      tenant_id: tenantId,
      plan_id: planId,
      provider: options.provider || 'manual',
      provider_subscription_id: options.provider_subscription_id,
      billing_cycle: options.billing_cycle || plan.billing_cycle,
      trial_days: options.trial_days ?? plan.trial_days,
      current_period_end: options.current_period_end,
      status: options.status,
    });

    await this.syncPlanModulesToTenant(tenantId, planId);

    if (options.limits) {
      await this.usageLimits.setLimits(tenantId, options.limits);
    }

    return { subscription, plan: await this.getPlan(planId) };
  }

  async updateSubscriptionStatus(subscriptionId, status) {
    if (!ACTIVE_STATUSES.includes(status) && !['CANCELED', 'SUSPENDED', 'EXPIRED'].includes(status)) {
      throw new Error(`Status de assinatura inválido: ${status}`);
    }
    return this.subscriptions.updateStatus(subscriptionId, status);
  }

  async syncPlanModulesToTenant(tenantId, planId) {
    const planModules = await this.plans.listModules(planId);
    for (const mod of planModules) {
      if (mod.included) {
        await this.modules.activateModuleForTenant(tenantId, mod.code, { source: 'PLAN' });
      } else {
        await this.modules.suspendModuleForTenant(tenantId, mod.code);
      }
    }
    return planModules.filter((m) => m.included);
  }

  async getTenantLimits(tenantId = DEFAULT_TENANT_ID) {
    return this.usageLimits.getLimits(tenantId);
  }

  async setTenantLimits(tenantId, limits) {
    const merged = { ...DEFAULT_USAGE_LIMITS, ...limits };
    return this.usageLimits.setLimits(tenantId, merged);
  }

  async getTenantUsageSummary(tenantId = DEFAULT_TENANT_ID) {
    const [limits, cached] = await Promise.all([
      this.usageLimits.getLimits(tenantId),
      this.usageLimits.getCachedMetrics(tenantId),
    ]);

    const metrics = cached.metrics || {};
    const usage = {};
    for (const [key, limit] of Object.entries(limits)) {
      if (key.startsWith('max_')) {
        const current = metrics[key] ?? null;
        usage[key] = {
          current,
          limit: limit < 0 ? null : limit,
          percent: limit > 0 && current != null ? Math.round((current / limit) * 100) : null,
        };
      }
    }

    return {
      limits,
      metrics,
      usage,
      measured_at: cached.measured_at,
    };
  }
}

let instance = null;

function getSaasBillingService() {
  if (!instance) instance = new SaasBillingService();
  return instance;
}

module.exports = { SaasBillingService, getSaasBillingService };
