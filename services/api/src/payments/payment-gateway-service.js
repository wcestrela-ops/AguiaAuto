const { getStore } = require('@aguia/integrations');
const { getPool } = require('../db/pool');
const { asaasProvider } = require('./providers/asaas-provider');
const { mercadopagoProvider } = require('./providers/mercadopago-provider');
const logger = require('../logger');

const PROVIDERS = {
  asaas: asaasProvider,
  mercadopago: mercadopagoProvider,
};

const DEFAULT_GATEWAY_CONFIG = {
  initial_primary: 'mercadopago',
  initial_backup: 'asaas',
  recurring_primary: 'asaas',
  recurring_backup: 'mercadopago',
  failover_enabled: true,
  prefer_pix: true,
};

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

class PaymentGatewayService {
  constructor() {
    this.pool = getPool();
  }

  async getGatewayConfig() {
    const store = getStore();
    const settings = await store.getSettings('payment_gateways');
    return { ...DEFAULT_GATEWAY_CONFIG, ...settings };
  }

  getProviderOrder(chargeType, config) {
    if (chargeType === 'initial') {
      return [config.initial_primary, config.initial_backup].filter(Boolean);
    }
    return [config.recurring_primary, config.recurring_backup].filter(Boolean);
  }

  async logAttempt({ userId, provider, operation, chargeType, success, failoverUsed, error }) {
    await this.pool.query(
      `INSERT INTO payment_gateway_logs
        (user_id, provider, operation, charge_type, success, failover_used, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, provider, operation, chargeType, success, failoverUsed, error || null]
    );
  }

  async executeWithFailover(chargeType, operation, context) {
    const config = await this.getGatewayConfig();
    const order = this.getProviderOrder(chargeType, config);
    const errors = [];

    for (let i = 0; i < order.length; i += 1) {
      const providerName = order[i];
      const provider = PROVIDERS[providerName];
      if (!provider) continue;

      try {
        const configured = await provider.isConfigured();
        if (!configured) {
          throw new Error(`${providerName} não configurado.`);
        }

        const result = await operation(provider, providerName);
        await this.logAttempt({
          userId: context.userId,
          provider: providerName,
          operation: context.operationName,
          chargeType,
          success: true,
          failoverUsed: i > 0,
        });

        return {
          ...result,
          provider: providerName,
          failover_used: i > 0,
          attempted_providers: [...errors.map(e => e.provider), providerName],
        };
      } catch (err) {
        errors.push({ provider: providerName, error: err.message });
        await this.logAttempt({
          userId: context.userId,
          provider: providerName,
          operation: context.operationName,
          chargeType,
          success: false,
          failoverUsed: i > 0,
          error: err.message,
        });
        logger.warn(`Gateway ${providerName} falhou (${chargeType}).`, {
          userId: context.userId,
          err: err.message,
        });
        if (!config.failover_enabled) break;
      }
    }

    throw new Error(
      errors.map(e => `${e.provider}: ${e.error}`).join(' | ')
      || 'Nenhum gateway de pagamento disponível.'
    );
  }

  async ensureCustomers(user, userRepo) {
    const updates = {};
    const errors = [];

    if (!user.asaas_customer_id && await asaasProvider.isConfigured()) {
      try {
        const result = await asaasProvider.ensureCustomer(user);
        updates.asaas_customer_id = result.external_customer_id;
        user.asaas_customer_id = result.external_customer_id;
      } catch (err) {
        errors.push({ provider: 'asaas', error: err.message });
      }
    }

    if (!user.mercadopago_payer_id) {
      updates.mercadopago_payer_id = user.email;
      user.mercadopago_payer_id = user.email;
    }

    if (Object.keys(updates).length) {
      await userRepo.updateProvisioning(user.id, updates);
    }

    return { user, errors };
  }

  async createInitialCharge({ user, plan, userId }) {
    const config = await this.getGatewayConfig();
    const dueDate = addDays(new Date(), 3);

    return this.executeWithFailover('initial', async (provider) => {
      if (provider.name === 'asaas') {
        await asaasProvider.ensureCustomer(user);
        return provider.createPixCharge({
          user,
          amount: plan.price_monthly,
          dueDate,
          description: `Adesão — Plano ${plan.name}`,
          preferPix: config.prefer_pix,
        });
      }

      return provider.createPixCharge({
        user,
        amount: plan.price_monthly,
        description: `Adesão — Plano ${plan.name}`,
        externalReference: `initial-user-${userId}-plan-${plan.id}`,
      });
    }, { userId, operationName: 'create_initial_charge' });
  }

  async createRecurringSubscription({ user, plan, userId }) {
    const config = await this.getGatewayConfig();
    const nextDueDate = addDays(new Date(), 30);

    return this.executeWithFailover('recurring', async (provider) => {
      if (provider.name === 'asaas') {
        await asaasProvider.ensureCustomer(user);
        return provider.createRecurringSubscription({
          user,
          plan,
          billingType: config.prefer_pix ? 'PIX' : 'UNDEFINED',
          nextDueDate,
        });
      }

      return provider.createRecurringSubscription({
        user,
        plan,
        externalReference: `sub-user-${userId}-plan-${plan.id}`,
      });
    }, { userId, operationName: 'create_recurring_subscription' });
  }

  async createMonthlyCharge({ user, amount, dueDate, description, userId }) {
    const config = await this.getGatewayConfig();

    return this.executeWithFailover('recurring', async (provider) => {
      if (provider.name === 'asaas') {
        await asaasProvider.ensureCustomer(user);
        return provider.createPixCharge({
          user,
          amount,
          dueDate,
          description,
          preferPix: config.prefer_pix,
        });
      }

      return provider.createPixCharge({
        user,
        amount,
        description,
        externalReference: `monthly-user-${userId}-${Date.now()}`,
      });
    }, { userId, operationName: 'create_monthly_charge' });
  }

  async refreshPayment(providerName, externalPaymentId) {
    const provider = PROVIDERS[providerName];
    if (!provider) throw new Error(`Provider ${providerName} inválido.`);
    return provider.refreshPayment(externalPaymentId);
  }

  async getStatus() {
    const config = await this.getGatewayConfig();
    const status = {};

    for (const [name, provider] of Object.entries(PROVIDERS)) {
      status[name] = {
        configured: await provider.isConfigured(),
        label: name === 'asaas' ? 'Asaas' : 'Mercado Pago',
      };
    }

    return { config, providers: status };
  }
}

let instance = null;

function getPaymentGatewayService() {
  if (!instance) instance = new PaymentGatewayService();
  return instance;
}

module.exports = { PaymentGatewayService, getPaymentGatewayService, PROVIDERS };
