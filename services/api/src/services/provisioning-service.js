const crypto = require('crypto');
const { getStore } = require('@aguia/integrations');
const asaas = require('../integrations/asaas');
const gpswox = require('../integrations/gpswox-gateway');
const { getUserRepository } = require('../repositories/user-repository');
const { getPlanRepository } = require('../repositories/plan-repository');
const { getSubscriptionRepository } = require('../repositories/subscription-repository');
const { getInvoiceRepository } = require('../repositories/invoice-repository');
const whatsapp = require('./whatsapp');
const { normalizePhone } = require('../lib/phone');
const logger = require('../logger');

function extractId(response, keys = ['id']) {
  if (!response) return null;
  for (const key of keys) {
    if (response[key] != null) return String(response[key]);
    if (response.data?.[key] != null) return String(response.data[key]);
    if (response.item?.[key] != null) return String(response.item[key]);
    if (Array.isArray(response.items) && response.items[0]?.[key] != null) {
      return String(response.items[0][key]);
    }
  }
  return null;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function generateGpswoxPassword() {
  return crypto.randomBytes(12).toString('base64url');
}

class ProvisioningService {
  constructor() {
    this.users = getUserRepository();
    this.plans = getPlanRepository();
    this.subscriptions = getSubscriptionRepository();
    this.invoices = getInvoiceRepository();
  }

  async provisionNewClient(userId, { plan_id, billing_type = 'UNDEFINED' } = {}) {
    const user = await this.users.findByIdWithProvisioning(userId);
    if (!user) throw new Error('Usuário não encontrado.');

    const errors = [];
    let asaasOk = Boolean(user.asaas_customer_id);
    let gpswoxOk = Boolean(user.gpswox_user_id);
    let subscriptionOk = false;

    try {
      if (!user.asaas_customer_id) {
        const customer = await asaas.createCustomer({
          name: user.name,
          email: user.email,
          cpfCnpj: user.cpf_cnpj,
          phone: user.phone,
        });
        const customerId = extractId(customer);
        if (!customerId) throw new Error('Asaas não retornou ID do cliente.');
        await this.users.updateProvisioning(userId, { asaas_customer_id: customerId });
        user.asaas_customer_id = customerId;
        asaasOk = true;
      }
    } catch (err) {
      errors.push({ step: 'asaas_customer', error: err.message });
      logger.warn('Falha ao criar cliente Asaas.', { userId, err: err.message });
    }

    try {
      if (!user.gpswox_user_id) {
        const store = getStore();
        const gpswoxSettings = await store.getSettings('gpswox');
        const password = generateGpswoxPassword();
        const payload = {
          email: user.email,
          password,
          name: user.name || user.email,
          phone: user.phone || undefined,
          group_id: gpswoxSettings.default_group_id || undefined,
        };
        const result = await gpswox.createCliente(payload);
        const gpswoxUserId = extractId(result, ['id', 'user_id']);
        if (!gpswoxUserId) {
          throw new Error('GPSWOX não retornou ID do usuário.');
        }
        await this.users.updateProvisioning(userId, { gpswox_user_id: gpswoxUserId });
        user.gpswox_user_id = gpswoxUserId;
        gpswoxOk = true;
      }
    } catch (err) {
      errors.push({ step: 'gpswox_user', error: err.message });
      logger.warn('Falha ao criar usuário GPSWOX.', { userId, err: err.message });
    }

    if (plan_id && user.asaas_customer_id) {
      try {
        const existing = await this.subscriptions.findActiveByUser(userId);
        if (!existing) {
          const plan = await this.plans.findById(plan_id);
          if (!plan) throw new Error('Plano não encontrado.');

          const nextDueDate = addDays(new Date(), 3);
          const asaasSub = await asaas.createSubscription({
            customerId: user.asaas_customer_id,
            value: plan.price_monthly,
            nextDueDate,
            billingType: billing_type,
            description: `Plano ${plan.name} — Águia`,
          });

          const asaasSubscriptionId = extractId(asaasSub);
          const subscription = await this.subscriptions.create({
            user_id: userId,
            plan_id: plan.id,
            asaas_subscription_id: asaasSubscriptionId,
            billing_type,
          });

          if (asaasSubscriptionId) {
            const payments = await asaas.getSubscriptionPayments(asaasSubscriptionId);
            for (const payment of payments) {
              await this.invoices.upsertFromAsaas({
                user_id: userId,
                subscription_id: subscription.id,
                ...payment,
              });
            }
          }

          subscriptionOk = true;
        } else {
          subscriptionOk = true;
        }
      } catch (err) {
        errors.push({ step: 'asaas_subscription', error: err.message });
        logger.warn('Falha ao criar assinatura Asaas.', { userId, err: err.message });
      }
    }

    const status = errors.length === 0 ? 'completed'
      : (asaasOk || gpswoxOk || subscriptionOk) ? 'partial' : 'failed';

    await this.users.updateProvisioning(userId, {
      provisioning_status: status,
      provisioning_errors: errors,
    });

    if (status === 'completed' && user.phone) {
      try {
        await whatsapp.sendWelcome(normalizePhone(user.phone), user.name, { user: user.email });
      } catch (err) {
        logger.warn('Falha ao enviar boas-vindas WhatsApp.', { userId, err: err.message });
      }
    }

    return {
      status,
      asaas: asaasOk,
      gpswox: gpswoxOk,
      subscription: subscriptionOk,
      errors,
    };
  }

  async retryProvisioning(userId) {
    const user = await this.users.findByIdWithProvisioning(userId);
    if (!user) throw new Error('Usuário não encontrado.');

    const subscription = await this.subscriptions.findActiveByUser(userId);
    return this.provisionNewClient(userId, {
      plan_id: subscription?.plan_id,
      billing_type: subscription?.billing_type || 'UNDEFINED',
    });
  }
}

let instance = null;

function getProvisioningService() {
  if (!instance) instance = new ProvisioningService();
  return instance;
}

module.exports = { ProvisioningService, getProvisioningService };
