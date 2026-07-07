const asaasIntegration = require('../../integrations/asaas');

function normalizeAsaasPayment(payment) {
  return {
    provider: 'asaas',
    external_payment_id: payment.asaas_payment_id || payment.external_payment_id,
    external_customer_id: payment.customer_id,
    external_subscription_id: payment.subscription_id || null,
    amount: payment.amount,
    due_date: payment.due_date,
    status: payment.status,
    billing_type: payment.billing_type === 'UNDEFINED' ? 'PIX' : payment.billing_type,
    description: payment.description,
    invoice_url: payment.invoice_url,
    bank_slip_url: payment.bank_slip_url,
    pix_qrcode: payment.pix_qrcode,
    pix_copy_paste: payment.pix_copy_paste,
    paid_at: payment.paid_at,
  };
}

const asaasProvider = {
  name: 'asaas',

  async isConfigured() {
    const config = await asaasIntegration.getConfig();
    return Boolean(config.api_key);
  },

  async ensureCustomer(user) {
    if (user.asaas_customer_id) {
      return { external_customer_id: user.asaas_customer_id };
    }
    const customer = await asaasIntegration.createCustomer({
      name: user.name,
      email: user.email,
      cpfCnpj: user.cpf_cnpj,
      phone: user.phone,
    });
    return { external_customer_id: customer.id, raw: customer };
  },

  async createPixCharge({ user, amount, dueDate, description, preferPix = true }) {
    const customerId = user.asaas_customer_id;
    if (!customerId) throw new Error('Cliente Asaas não vinculado.');

    const payment = await asaasIntegration.createPayment({
      customerId,
      value: amount,
      dueDate,
      billingType: preferPix ? 'PIX' : 'UNDEFINED',
      description,
    });
    return normalizeAsaasPayment(payment);
  },

  async createRecurringSubscription({ user, plan, billingType = 'PIX', nextDueDate }) {
    const customerId = user.asaas_customer_id;
    if (!customerId) throw new Error('Cliente Asaas não vinculado.');

    const subscription = await asaasIntegration.createSubscription({
      customerId,
      value: plan.price_monthly,
      nextDueDate,
      billingType: billingType === 'UNDEFINED' ? 'PIX' : billingType,
      description: `Plano ${plan.name} — Águia`,
    });

    const payments = subscription.id
      ? await asaasIntegration.getSubscriptionPayments(subscription.id)
      : [];

    return {
      external_subscription_id: subscription.id,
      payments: payments.map(normalizeAsaasPayment),
      raw: subscription,
    };
  },

  async refreshPayment(externalPaymentId) {
    const payment = await asaasIntegration.getPayment(externalPaymentId);
    return normalizeAsaasPayment(payment);
  },

  formatWebhook(payload) {
    if (!payload?.payment) return null;
    return normalizeAsaasPayment(payload.payment);
  },
};

module.exports = { asaasProvider, normalizeAsaasPayment };
