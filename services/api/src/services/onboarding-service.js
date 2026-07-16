const { getUserRepository } = require('../repositories/user-repository');
const { getVehicleRepository, VEHICLE_STATUS } = require('../repositories/vehicle-repository');
const { getPlanRepository } = require('../repositories/plan-repository');
const { getAuthService } = require('./auth-service');
const { getProvisioningService } = require('./provisioning-service');
const { getContractService } = require('./contract-service');
const { getReferralService } = require('./referral-service');
const authNotifications = require('./auth-notifications');
const { validateCpfCnpj, formatCpfCnpj } = require('../lib/cpf-cnpj');
const { normalizePhone } = require('../lib/phone');
const logger = require('../logger');

const ONBOARDING_STEPS = [
  'validacao_cpf_cnpj',
  'confirmacao_email',
  'confirmacao_whatsapp',
  'escolha_plano',
  'cadastro_veiculo',
  'assinatura_contrato',
  'pagamento_asaas',
  'criacao_gpswox',
  'liberacao_acesso',
];

function normalizePlate(plate) {
  const normalized = String(plate || '').trim().toUpperCase();
  return normalized || null;
}

function stepResult(step, status, extra = {}) {
  return { step, status, ...extra };
}

class OnboardingService {
  constructor() {
    this.users = getUserRepository();
    this.vehicles = getVehicleRepository();
    this.plans = getPlanRepository();
  }

  getFlowInfo() {
    return {
      etapas: ONBOARDING_STEPS,
      campos_obrigatorios: [
        'name',
        'email',
        'password',
        'cpf_cnpj',
        'phone',
        'plan_id',
        'accept_terms',
      ],
    };
  }

  async cadastro(payload, { ip, userAgent } = {}) {
    const steps = [];

    const name = payload.name?.trim();
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password;
    const phoneRaw = payload.phone?.trim();
    const billingType = payload.billing_type || 'PIX';
    const referralCode = payload.referral_code?.trim();
    const acceptTerms = payload.accept_terms === true || payload.accept_terms === 'true';
    const planId = payload.plan_id ? Number(payload.plan_id) : null;
    const vehicleInput = payload.vehicle || {};

    if (!name) throw new Error('Nome é obrigatório.');
    if (!email) throw new Error('E-mail é obrigatório.');
    if (!password || password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres.');
    if (!phoneRaw) throw new Error('Telefone é obrigatório para contato e WhatsApp.');
    if (!planId) throw new Error('Selecione um plano para continuar.');
    if (!acceptTerms) throw new Error('Aceite o Contrato de Prestação de Serviços para continuar.');

    const plate = normalizePlate(vehicleInput.plate);

    const cpfCheck = validateCpfCnpj(payload.cpf_cnpj);
    if (!cpfCheck.valid) throw new Error(cpfCheck.error);
    steps.push(stepResult('validacao_cpf_cnpj', 'ok', { type: cpfCheck.type }));

    const formattedCpf = formatCpfCnpj(cpfCheck.normalized);
    const phone = normalizePhone(phoneRaw);

    const [existingEmail, existingCpf, existingPlate, plan] = await Promise.all([
      this.users.findByEmail(email),
      this.users.findByCpfCnpj(cpfCheck.normalized),
      plate ? this.vehicles.findByPlate(plate) : Promise.resolve(null),
      this.plans.findById(planId),
    ]);

    if (existingEmail) throw new Error('E-mail já cadastrado.');
    if (existingCpf) throw new Error('CPF/CNPJ já cadastrado.');
    if (existingPlate) throw new Error('Placa já cadastrada em outro veículo.');
    if (!plan || !plan.active) throw new Error('Plano não encontrado ou indisponível.');

    steps.push(stepResult('escolha_plano', 'ok', {
      plan_id: plan.id,
      plan_name: plan.name,
      price_monthly: Number(plan.price_monthly),
    }));

    if (referralCode) {
      const validation = await getReferralService().validateCode(referralCode);
      if (!validation.valido) {
        throw new Error(validation.motivo || 'Código de indicação inválido.');
      }
    }

    const user = await this.users.create({
      email,
      password,
      name,
      phone: phoneRaw,
      cpf_cnpj: formattedCpf,
    });

    const vehicle = await this.vehicles.create({
      user_id: user.id,
      plate,
      brand: vehicleInput.brand?.trim() || null,
      model: vehicleInput.model?.trim() || null,
      color: vehicleInput.color?.trim() || null,
      year: vehicleInput.year ? Number(vehicleInput.year) : null,
      status: VEHICLE_STATUS.PENDING_INSTALLATION,
    });
    steps.push(stepResult('cadastro_veiculo', 'ok', {
      vehicle_id: vehicle.id,
      plate: vehicle.plate,
      status: vehicle.status,
    }));

    const welcome = await authNotifications.sendRegistrationWelcome({
      user,
      password,
      plan,
      vehicle,
      referralCode,
    });
    steps.push(stepResult(
      'confirmacao_email',
      welcome.channels.includes('email') ? 'sent' : 'skipped',
      { channels: welcome.channels },
    ));
    steps.push(stepResult(
      'confirmacao_whatsapp',
      welcome.channels.includes('whatsapp') || welcome.channels.includes('sms') ? 'sent' : 'skipped',
      { channels: welcome.channels.filter((c) => c === 'whatsapp' || c === 'sms') },
    ));
    steps.push(stepResult(
      'confirmacao_push',
      welcome.channels.includes('push') ? 'sent' : 'skipped',
      { channels: welcome.channels.filter((c) => c === 'push') },
    ));
    if (welcome.central?.recipients > 0 || welcome.central?.channels?.length) {
      steps.push(stepResult('notificacao_central', 'sent', {
        channels: welcome.central.channels,
        recipients: welcome.central.recipients,
      }));
    } else {
      steps.push(stepResult('notificacao_central', 'skipped', { reason: 'disabled_or_no_recipients' }));
    }

    let referral = null;
    if (referralCode) {
      try {
        referral = await getReferralService().processReferralOnRegister({
          referredUserId: user.id,
          referralCode,
        });
      } catch (err) {
        logger.warn('Onboarding: falha ao processar indicação.', { userId: user.id, err: err.message });
      }
    }

    let provisioning = null;
    try {
      provisioning = await getProvisioningService().provisionNewClient(user.id, {
        plan_id: planId,
        billing_type: billingType,
      });
      steps.push(stepResult(
        'pagamento_asaas',
        provisioning.initial_payment || provisioning.subscription ? 'ok' : 'partial',
        {
          initial_payment: provisioning.initial_payment,
          subscription: provisioning.subscription,
          errors: provisioning.errors?.filter((e) => e.step?.includes('charge') || e.step?.includes('subscription')),
        },
      ));
      steps.push(stepResult(
        'criacao_gpswox',
        provisioning.gpswox ? 'ok' : 'partial',
        {
          gpswox: provisioning.gpswox,
          asaas: provisioning.asaas,
          mercadopago: provisioning.mercadopago,
          errors: provisioning.errors?.filter((e) => e.step?.includes('gpswox') || e.step?.includes('asaas') || e.step?.includes('mercadopago')),
        },
      ));
    } catch (err) {
      steps.push(stepResult('pagamento_asaas', 'failed', { error: err.message }));
      steps.push(stepResult('criacao_gpswox', 'failed', { error: err.message }));
      await this.users.updateProvisioning(user.id, {
        provisioning_status: 'failed',
        provisioning_errors: [{ step: 'onboarding', error: err.message }],
      });
      logger.warn('Onboarding: provisionamento falhou.', { userId: user.id, err: err.message });
    }

    let contract = null;
    try {
      contract = await getContractService().acceptServiceContract(user.id, {
        ip,
        userAgent,
      });
      steps.push(stepResult('assinatura_contrato', 'ok', {
        acceptance_id: contract.acceptance?.id || contract.acceptance_id,
        already_accepted: contract.already_accepted || false,
      }));
    } catch (err) {
      steps.push(stepResult('assinatura_contrato', 'failed', { error: err.message }));
      logger.warn('Onboarding: aceite de contrato falhou.', { userId: user.id, err: err.message });
    }

    const session = await getAuthService().establishSession(user, { ip, forceAccess: true });
    steps.push(stepResult('liberacao_acesso', 'ok', {
      contract_accepted: Boolean(contract),
      provisioning_status: provisioning?.status || 'pending',
    }));

    return {
      ...session,
      onboarding: {
        steps,
        provisioning,
        contract,
        referral: referral ? { registered: true } : null,
        vehicle: {
          id: vehicle.id,
          plate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          status: vehicle.status,
        },
        next_path: contract ? '/app' : '/app/contratos',
      },
    };
  }
}

let instance = null;

function getOnboardingService() {
  if (!instance) instance = new OnboardingService();
  return instance;
}

module.exports = {
  OnboardingService,
  getOnboardingService,
  ONBOARDING_STEPS,
};
