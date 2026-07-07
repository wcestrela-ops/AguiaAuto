const mercadopago = require('../../integrations/mercadopago');

const mercadopagoProvider = {
  name: 'mercadopago',

  async isConfigured() {
    const config = await mercadopago.getConfig();
    return Boolean(config.access_token);
  },

  async ensureCustomer(user) {
    return {
      external_customer_id: user.mercadopago_payer_id || user.email,
      payer_email: user.email,
    };
  },

  async createPixCharge({ user, amount, description, externalReference }) {
    const payment = await mercadopago.createPixPayment({
      email: user.email,
      name: user.name,
      cpfCnpj: user.cpf_cnpj,
      amount,
      description,
      externalReference,
    });
    return {
      ...payment,
      external_customer_id: payment.customer_id,
    };
  },

  async createRecurringSubscription({ user, plan, externalReference }) {
    const result = await mercadopago.createPreapproval({
      email: user.email,
      amount: plan.price_monthly,
      description: `Plano ${plan.name} — Águia`,
      externalReference,
    });

    return {
      external_subscription_id: result.external_subscription_id,
      init_point: result.init_point,
      payments: [],
      raw: result,
    };
  },

  async refreshPayment(externalPaymentId) {
    return mercadopago.getPayment(externalPaymentId);
  },

  formatWebhook(payload) {
    return payload?.payment || null;
  },
};

module.exports = { mercadopagoProvider };
