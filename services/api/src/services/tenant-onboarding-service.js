const crypto = require('crypto');
const { getTenantRepository } = require('../repositories/tenant-repository');
const { getUserRepository } = require('../repositories/user-repository');
const { getRbacRepository } = require('../repositories/rbac-repository');
const { getSaasBillingService } = require('./saas-billing-service');
const { getTenantIntegrationService } = require('./tenant-integration-service');
const { validatePassword } = require('../lib/security/password-policy');
const { validateCpfCnpj, formatCpfCnpj } = require('../lib/cpf-cnpj');
const { DEFAULT_USAGE_LIMITS } = require('../db/migrate-phase4-saas-billing');

const ONBOARDING_STEPS = [
  'validacao_dados',
  'criacao_tenant',
  'integracoes_shared',
  'assinatura_saas',
  'limites_uso',
  'usuario_owner',
  'conclusao',
];

function stepResult(step, status, extra = {}) {
  return { step, status, ...extra };
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateTemporaryPassword() {
  return crypto.randomBytes(12).toString('base64url');
}

class TenantOnboardingService {
  constructor() {
    this.tenants = getTenantRepository();
    this.users = getUserRepository();
    this.rbac = getRbacRepository();
    this.billing = getSaasBillingService();
    this.integrations = getTenantIntegrationService();
  }

  getSchema() {
    return {
      steps: ONBOARDING_STEPS,
      company_fields: ['name', 'trade_name', 'slug', 'email', 'phone', 'document_type', 'document_number'],
      owner_fields: ['name', 'email', 'phone', 'password'],
      defaults: {
        status: 'TRIAL',
        trial_days: 14,
        credential_mode: 'SHARED',
      },
    };
  }

  async onboardTenant(payload, { createdBy = null } = {}) {
    const steps = [];
    const company = payload.company || {};
    const owner = payload.owner || {};
    const planId = Number(payload.plan_id);
    const trialDays = payload.trial_days ?? 14;

    const name = company.name?.trim();
    const tradeName = company.trade_name?.trim() || name;
    const slug = slugify(company.slug || tradeName || name);
    const companyEmail = company.email?.trim().toLowerCase();
    const ownerEmail = owner.email?.trim().toLowerCase();
    const ownerName = owner.name?.trim();
    const ownerPhone = owner.phone?.trim() || company.phone?.trim() || null;

    if (!name) throw new Error('Nome da empresa é obrigatório.');
    if (!slug) throw new Error('Slug da empresa é obrigatório.');
    if (!ownerEmail) throw new Error('E-mail do responsável é obrigatório.');
    if (!ownerName) throw new Error('Nome do responsável é obrigatório.');
    if (!planId) throw new Error('plan_id (plano SaaS) é obrigatório.');

    if (company.document_number) {
      const docCheck = validateCpfCnpj(company.document_number);
      if (!docCheck.valid) throw new Error(docCheck.error);
      company.document_number = formatCpfCnpj(docCheck.normalized);
      company.document_type = docCheck.type === 'cnpj' ? 'CNPJ' : 'CPF';
      steps.push(stepResult('validacao_dados', 'ok', { document_type: company.document_type }));
    } else {
      steps.push(stepResult('validacao_dados', 'ok'));
    }

    const [existingSlug, existingOwnerEmail, plan] = await Promise.all([
      this.tenants.findBySlug(slug),
      this.users.findByEmail(ownerEmail),
      this.billing.getPlan(planId),
    ]);

    if (existingSlug) throw new Error(`Slug "${slug}" já está em uso.`);
    if (existingOwnerEmail) throw new Error('E-mail do responsável já cadastrado.');
    if (!plan) throw new Error('Plano SaaS não encontrado.');

    const tenant = await this.tenants.create({
      name,
      trade_name: tradeName,
      legal_name: company.legal_name?.trim() || tradeName,
      slug,
      email: companyEmail || ownerEmail,
      phone: company.phone?.trim() || ownerPhone,
      document_type: company.document_type || null,
      document_number: company.document_number || null,
      status: payload.status || 'TRIAL',
    });
    steps.push(stepResult('criacao_tenant', 'ok', { tenant_id: tenant.id, slug: tenant.slug }));

    const integrationSeed = await this.integrations.seedSharedIntegrationsForTenant(tenant.id);
    steps.push(stepResult('integracoes_shared', 'ok', integrationSeed));

    const subscription = await this.billing.assignPlanToTenant(tenant.id, planId, {
      trial_days: trialDays,
      billing_cycle: plan.billing_cycle,
    });
    steps.push(stepResult('assinatura_saas', 'ok', {
      subscription_id: subscription.subscription.id,
      plan_code: plan.code,
      status: subscription.subscription.status,
    }));

    await this.billing.setTenantLimits(tenant.id, payload.limits || DEFAULT_USAGE_LIMITS);
    steps.push(stepResult('limites_uso', 'ok'));

    let ownerPassword = owner.password;
    if (ownerPassword) {
      const pwdCheck = validatePassword(ownerPassword, { email: ownerEmail });
      if (!pwdCheck.valid) throw new Error(pwdCheck.errors.join(' '));
    } else {
      ownerPassword = generateTemporaryPassword();
    }

    const ownerUser = await this.users.create({
      email: ownerEmail,
      password: ownerPassword,
      name: ownerName,
      phone: ownerPhone,
      role: 'superadmin',
      tenant_id: tenant.id,
    });
    await this.rbac.assignRoleToUser(ownerUser.id, 'superadmin');
    steps.push(stepResult('usuario_owner', 'ok', {
      user_id: ownerUser.id,
      email: ownerUser.email,
      temporary_password: owner.password ? undefined : ownerPassword,
    }));

    steps.push(stepResult('conclusao', 'ok', {
      admin_login_url: '/admin/login',
      tenant_detail_url: `/platform/tenants/${tenant.id}`,
      created_by: createdBy,
    }));

    return {
      tenant,
      owner: {
        id: ownerUser.id,
        email: ownerUser.email,
        name: ownerUser.name,
        role: ownerUser.role,
        temporary_password: owner.password ? null : ownerPassword,
      },
      subscription: subscription.subscription,
      plan: subscription.plan,
      steps,
    };
  }
}

let instance = null;

function getTenantOnboardingService() {
  if (!instance) instance = new TenantOnboardingService();
  return instance;
}

module.exports = {
  TenantOnboardingService,
  getTenantOnboardingService,
  ONBOARDING_STEPS,
  slugify,
  generateTemporaryPassword,
};
