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

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

async function fetchAllPaginated(fetchPage, pageSize = 100) {
  const items = [];
  let offset = 0;

  while (true) {
    const page = await fetchPage({ offset, limit: pageSize });
    const batch = page?.data || [];
    items.push(...batch);
    if (!page?.hasMore) break;
    offset += pageSize;
  }

  return items;
}

function formatCustomer(customer) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    cpf_cnpj: customer.cpfCnpj || null,
    phone: customer.mobilePhone || customer.phone || null,
    deleted: Boolean(customer.deleted),
  };
}

const SUBSCRIPTION_STATUS_MAP = {
  ACTIVE: 'active',
  EXPIRED: 'cancelled',
  INACTIVE: 'cancelled',
};

function mapSubscriptionStatus(asaasStatus) {
  return SUBSCRIPTION_STATUS_MAP[asaasStatus] || 'cancelled';
}

function formatSubscription(subscription) {
  return {
    id: subscription.id,
    customer_id: subscription.customer,
    status: mapSubscriptionStatus(subscription.status),
    asaas_status: subscription.status || null,
    value: subscription.value,
    billing_type: subscription.billingType,
    cycle: subscription.cycle,
    next_due_date: subscription.nextDueDate,
    description: subscription.description,
  };
}

async function listCustomers({ offset = 0, limit = 100, cpfCnpj, email, name } = {}) {
  const cpf = onlyDigits(cpfCnpj);
  return request(`/customers${buildQuery({
    offset,
    limit: Math.min(limit, 100),
    cpfCnpj: cpf || undefined,
    email,
    name,
  })}`);
}

async function listPayments({ offset = 0, limit = 100, customer, subscription } = {}) {
  return request(`/payments${buildQuery({
    offset,
    limit: Math.min(limit, 100),
    customer,
    subscription,
  })}`);
}

async function listSubscriptions({ offset = 0, limit = 100, customer } = {}) {
  return request(`/subscriptions${buildQuery({
    offset,
    limit: Math.min(limit, 100),
    customer,
  })}`);
}

async function listAllCustomers(filters = {}) {
  const customers = await fetchAllPaginated(
    ({ offset, limit }) => listCustomers({ ...filters, offset, limit }),
  );
  return customers.filter((customer) => !customer.deleted).map(formatCustomer);
}

async function listCustomerPayments(customerId) {
  const payments = await fetchAllPaginated(
    ({ offset, limit }) => listPayments({ customer: customerId, offset, limit }),
  );
  return payments.map(formatPayment);
}

async function listCustomerSubscriptions(customerId) {
  const subscriptions = await fetchAllPaginated(
    ({ offset, limit }) => listSubscriptions({ customer: customerId, offset, limit }),
  );
  return subscriptions.map(formatSubscription);
}

async function findCustomer({ cpfCnpj, email } = {}) {
  if (cpfCnpj) {
    const page = await listCustomers({ cpfCnpj, limit: 1 });
    if (page?.data?.[0]) return formatCustomer(page.data[0]);
  }
  if (email) {
    const page = await listCustomers({ email, limit: 1 });
    if (page?.data?.[0]) return formatCustomer(page.data[0]);
  }
  return null;
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
  findCustomer,
  listCustomers,
  listPayments,
  listSubscriptions,
  listAllCustomers,
  listCustomerPayments,
  listCustomerSubscriptions,
  createPayment,
  createSubscription,
  getSubscriptionPayments,
  getPayment,
  updatePayment,
  deletePayment,
  handleWebhook,
  formatPayment,
  formatCustomer,
  formatSubscription,
  mapPaymentStatus,
  mapSubscriptionStatus,
  fetchAllPaginated,
};
