const crypto = require('crypto');
const { getStore } = require('@aguia/integrations');
const gpswox = require('../integrations/gpswox-gateway');
const { getUserRepository } = require('../repositories/user-repository');
const { getPlanRepository } = require('../repositories/plan-repository');
const { getSubscriptionRepository } = require('../repositories/subscription-repository');
const { getInvoiceRepository } = require('../repositories/invoice-repository');
const { getPaymentGatewayService } = require('../payments/payment-gateway-service');
const { sendBillingReminder } = require('./billing-notifications');
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

function generateGpswoxPassword() {
  return crypto.randomBytes(12).toString('base64url');
}

class ProvisioningService {
  constructor() {
    this.users = getUserRepository();
    this.plans = getPlanRepository();
    this.subscriptions = getSubscriptionRepository();
    this.invoices = getInvoiceRepository();
    this.payments = getPaymentGatewayService();
  }

  async provisionNewClient(userId, { plan_id, billing_type = 'PIX' } = {}) {
    let user = await this.users.findByIdWithProvisioning(userId);
    if (!user) throw new Error('Usuário não encontrado.');

    const errors = [];
    let paymentOk = false;
    let gpswoxOk = Boolean(user.gpswox_user_id);
    let subscriptionOk = false;

    const customerResult = await this.payments.ensureCustomers(user, this.users);
    user = customerResult.user;
    errors.push(...customerResult.errors.map(e => ({ step: `${e.provider}_customer`, error: e.error })));

    try {
      if (!user.gpswox_user_id) {
        const store = getStore();
        const gpswoxSettings = await store.getSettings('gpswox');
        const password = generateGpswoxPassword();
        const result = await gpswox.createCliente({
          email: user.email,
          password,
          name: user.name || user.email,
          phone: user.phone || undefined,
          group_id: gpswoxSettings.default_group_id || undefined,
        });
        const gpswoxUserId = extractId(result, ['id', 'user_id']);
        if (!gpswoxUserId) throw new Error('GPSWOX não retornou ID do usuário.');
        await this.users.updateProvisioning(userId, { gpswox_user_id: gpswoxUserId });
        user.gpswox_user_id = gpswoxUserId;
        gpswoxOk = true;
      }
    } catch (err) {
      errors.push({ step: 'gpswox_user', error: err.message });
      logger.warn('Falha ao criar usuário GPSWOX.', { userId, err: err.message });
    }

    if (plan_id) {
      try {
        const existing = await this.subscriptions.findActiveByUser(userId);
        const plan = await this.plans.findById(plan_id);
        if (!plan) throw new Error('Plano não encontrado.');

        if (!existing) {
          let subscription = null;

          try {
            const initial = await this.payments.createInitialCharge({ user, plan, userId });
            const initialInvoice = await this.invoices.upsertFromPayment({
              user_id: userId,
              description: `Adesão — Plano ${plan.name}`,
              is_initial_charge: true,
              ...initial,
            });
            paymentOk = true;

            if (user.phone && (initialInvoice.pix_copy_paste || initialInvoice.invoice_url)) {
              await sendBillingReminder(normalizePhone(user.phone), {
                valor: Number(initialInvoice.amount).toFixed(2),
                vencimento: initialInvoice.due_date,
                link: initialInvoice.invoice_url || 'Use o código PIX no app',
              }, {
                userId,
                user: user.email,
                invoiceId: initialInvoice.id,
                trigger: 'billing.initial',
              });
            }
          } catch (err) {
            errors.push({ step: 'initial_charge', error: err.message });
            logger.warn('Falha na cobrança inicial.', { userId, err: err.message });
          }

          try {
            const recurring = await this.payments.createRecurringSubscription({ user, plan, userId });
            const provider = recurring.provider;

            subscription = await this.subscriptions.create({
              user_id: userId,
              plan_id: plan.id,
              payment_provider: provider,
              billing_type: billing_type || 'PIX',
              asaas_subscription_id: provider === 'asaas' ? recurring.external_subscription_id : null,
              mercadopago_subscription_id: provider === 'mercadopago' ? recurring.external_subscription_id : null,
              external_subscription_id: recurring.external_subscription_id,
            });

            for (const payment of recurring.payments || []) {
              await this.invoices.upsertFromPayment({
                user_id: userId,
                subscription_id: subscription.id,
                ...payment,
              });
            }

            if (provider === 'mercadopago' && recurring.init_point && user.phone) {
              await sendBillingReminder(normalizePhone(user.phone), {
                valor: Number(plan.price_monthly).toFixed(2),
                vencimento: 'Assinatura recorrente',
                link: recurring.init_point,
              }, {
                userId,
                user: user.email,
                trigger: 'billing.subscription',
              });
            }

            subscriptionOk = true;
          } catch (err) {
            errors.push({ step: 'recurring_subscription', error: err.message });
            logger.warn('Falha na assinatura recorrente.', { userId, err: err.message });
          }
        } else {
          subscriptionOk = true;
          paymentOk = true;
        }
      } catch (err) {
        errors.push({ step: 'plan_provision', error: err.message });
      }
    }

    const status = errors.length === 0 ? 'completed'
      : (gpswoxOk || paymentOk || subscriptionOk) ? 'partial' : 'failed';

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
      asaas: Boolean(user.asaas_customer_id),
      mercadopago: Boolean(user.mercadopago_payer_id),
      gpswox: gpswoxOk,
      initial_payment: paymentOk,
      subscription: subscriptionOk,
      errors,
    };
  }

  async retryProvisioning(userId) {
    const subscription = await this.subscriptions.findActiveByUser(userId);
    return this.provisionNewClient(userId, {
      plan_id: subscription?.plan_id,
      billing_type: subscription?.billing_type || 'PIX',
    });
  }
}

let instance = null;

function getProvisioningService() {
  if (!instance) instance = new ProvisioningService();
  return instance;
}

module.exports = { ProvisioningService, getProvisioningService };
