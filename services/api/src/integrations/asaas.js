const { getStore } = require('@aguia/integrations');
const logger = require('../logger');

const ASAAS_STATUS_MAP = {
  PENDING: 'pending',
  RECEIVED: 'paid',
  CONFIRMED: 'paid',
  OVERDUE: 'overdue',
  REFUNDED: 'refunded',
  RECEIVED_IN_CASH: 'paid',
  REFUND_REQUESTED: 'pending',
  CHARGEBACK_REQUESTED: 'pending',
  CHARGEBACK_DISPUTE: 'pending',
  AWAITING_CHARGEBACK_REVERSAL: 'pending',
  DUNNING_REQUESTED: 'overdue',
  DUNNING_RECEIVED: 'paid',
  AWAITING_RISK_ANALYSIS: 'pending',
};

async function getConfig() {
  const store = getStore();
  return store.getSettings('asaas');
}

function getBaseUrl(config) {
  return config.sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';
}

async function request(path, options = {}) {
  const config = await getConfig();
  if (!config.api_key) {
    throw new Error('Asaas não configurado. Configure api_key no painel admin.');
  }

  const url = `${getBaseUrl(config)}${path}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      access_token: config.api_key,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.errors?.[0]?.description || data?.message || `Erro Asaas (${response.status})`;
    logger.error('Erro na API Asaas.', { path, status: response.status, data });
    throw new Error(message);
  }

  return data;
}

function mapPaymentStatus(asaasStatus) {
  return ASAAS_STATUS_MAP[asaasStatus] || 'pending';
}

function formatPayment(payment) {
  return {
    provider: 'asaas',
    asaas_payment_id: payment.id,
    external_payment_id: String(payment.id),
    amount: payment.value,
    due_date: payment.dueDate,
    status: mapPaymentStatus(payment.status),
    billing_type: payment.billingType,
    description: payment.description,
    invoice_url: payment.invoiceUrl || null,
    bank_slip_url: payment.bankSlipUrl || null,
    pix_qrcode: payment.pixQrCodeUrl || payment.encodedImage || null,
    pix_copy_paste: payment.pixCopiaECola || null,
    paid_at: payment.paymentDate || payment.clientPaymentDate || null,
    customer_id: payment.customer,
    subscription_id: payment.subscription || null,
  };
}

function onlyDigits(value) {
  return value ? String(value).replace(/\D/g, '') : '';
}

async function createCustomer({ name, email, cpfCnpj, phone }) {
  const mobilePhone = onlyDigits(phone);
  const cpf = onlyDigits(cpfCnpj);

  return request('/customers', {
    method: 'POST',
    body: {
      name: name || email,
      email,
      cpfCnpj: cpf || undefined,
      mobilePhone: mobilePhone || undefined,
      notificationDisabled: false,
    },
  });
}

async function getCustomer(customerId) {
  return request(`/customers/${customerId}`);
}

async function createPayment({ customerId, value, dueDate, billingType = 'UNDEFINED', description }) {
  const payment = await request('/payments', {
    method: 'POST',
    body: {
      customer: customerId,
      billingType,
      value: Number(value),
      dueDate,
      description: description || 'Cobrança Águia Gestão Veicular',
    },
  });
  return formatPayment(payment);
}

async function createSubscription({
  customerId,
  value,
  nextDueDate,
  billingType = 'UNDEFINED',
  cycle = 'MONTHLY',
  description,
}) {
  return request('/subscriptions', {
    method: 'POST',
    body: {
      customer: customerId,
      billingType,
      value: Number(value),
      nextDueDate,
      cycle,
      description: description || 'Assinatura Águia Gestão Veicular',
    },
  });
}

async function getSubscriptionPayments(subscriptionId) {
  const data = await request(`/subscriptions/${subscriptionId}/payments`);
  const items = data?.data || data?.items || [];
  return (Array.isArray(items) ? items : []).map(formatPayment);
}

async function getPayment(paymentId) {
  const payment = await request(`/payments/${paymentId}`);
  return formatPayment(payment);
}

async function updatePayment(paymentId, { value, description }) {
  const body = {};
  if (value != null) body.value = Number(value);
  if (description) body.description = description;

  const payment = await request(`/payments/${paymentId}`, {
    method: 'PUT',
    body,
  });
  return formatPayment(payment);
}

async function deletePayment(paymentId) {
  return request(`/payments/${paymentId}`, { method: 'DELETE' });
}

async function handleWebhook(payload) {
  const event = payload?.event;
  const payment = payload?.payment;

  if (!event || !payment) {
    return { processed: false, reason: 'Payload inválido.' };
  }

  return {
    processed: true,
    event,
    payment: formatPayment(payment),
  };
}

module.exports = {
  getConfig,
  createCustomer,
  getCustomer,
  createPayment,
  createSubscription,
  getSubscriptionPayments,
  getPayment,
  updatePayment,
  deletePayment,
  handleWebhook,
  formatPayment,
  mapPaymentStatus,
};
