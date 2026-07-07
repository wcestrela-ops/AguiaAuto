const crypto = require('crypto');
const { getStore } = require('@aguia/integrations');
const logger = require('../logger');

const MP_STATUS_MAP = {
  pending: 'pending',
  approved: 'paid',
  authorized: 'paid',
  in_process: 'pending',
  in_mediation: 'pending',
  rejected: 'cancelled',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'overdue',
};

async function getConfig() {
  const store = getStore();
  return store.getSettings('mercadopago');
}

function getBaseUrl() {
  return 'https://api.mercadopago.com';
}

function onlyDigits(value) {
  return value ? String(value).replace(/\D/g, '') : '';
}

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || 'Cliente',
    last_name: parts.slice(1).join(' ') || 'Águia',
  };
}

function formatPayment(payment) {
  const pixData = payment.point_of_interaction?.transaction_data || {};
  return {
    provider: 'mercadopago',
    external_payment_id: String(payment.id),
    amount: payment.transaction_amount,
    due_date: payment.date_of_expiration?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    status: mapPaymentStatus(payment.status),
    billing_type: payment.payment_method_id === 'pix' ? 'PIX' : (payment.payment_type_id || 'MP'),
    description: payment.description,
    invoice_url: payment.transaction_details?.external_resource_url || pixData.ticket_url || null,
    bank_slip_url: null,
    pix_qrcode: pixData.qr_code_base64 || null,
    pix_copy_paste: pixData.qr_code || null,
    paid_at: payment.date_approved || null,
    customer_id: payment.payer?.id ? String(payment.payer.id) : payment.payer?.email || null,
    subscription_id: payment.metadata?.subscription_id || null,
  };
}

function mapPaymentStatus(status) {
  return MP_STATUS_MAP[status] || 'pending';
}

async function request(path, options = {}) {
  const config = await getConfig();
  if (!config.access_token) {
    throw new Error('Mercado Pago não configurado. Configure access_token no painel admin.');
  }

  const idempotencyKey = options.idempotencyKey || crypto.randomUUID();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.access_token}`,
      'X-Idempotency-Key': idempotencyKey,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || data?.cause?.[0]?.description || `Erro Mercado Pago (${response.status})`;
    logger.error('Erro na API Mercado Pago.', { path, status: response.status, data });
    throw new Error(message);
  }

  return data;
}

async function createPixPayment({ email, name, cpfCnpj, amount, description, externalReference }) {
  const config = await getConfig();
  const { first_name, last_name } = splitName(name);
  const cpf = onlyDigits(cpfCnpj);

  const body = {
    transaction_amount: Number(amount),
    description: description || 'Mensalidade Águia Gestão Veicular',
    payment_method_id: 'pix',
    external_reference: externalReference || undefined,
    notification_url: config.notification_url || undefined,
    payer: {
      email,
      first_name,
      last_name,
      identification: cpf ? { type: cpf.length > 11 ? 'CNPJ' : 'CPF', number: cpf } : undefined,
    },
  };

  const payment = await request('/v1/payments', { method: 'POST', body });
  return formatPayment(payment);
}

async function getPayment(paymentId) {
  const payment = await request(`/v1/payments/${paymentId}`);
  return formatPayment(payment);
}

async function createPreapproval({
  email,
  amount,
  description,
  externalReference,
  startDate,
}) {
  const config = await getConfig();
  const start = startDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const body = {
    reason: description || 'Assinatura Águia Gestão Veicular',
    external_reference: externalReference,
    payer_email: email,
    back_url: config.notification_url || 'https://www.mercadopago.com.br',
    status: 'pending',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: Number(amount),
      currency_id: 'BRL',
      start_date: start,
    },
  };

  const preapproval = await request('/preapproval', { method: 'POST', body });
  return {
    provider: 'mercadopago',
    external_subscription_id: String(preapproval.id),
    init_point: preapproval.init_point,
    status: preapproval.status,
    amount,
    email,
  };
}

async function getPreapproval(preapprovalId) {
  return request(`/preapproval/${preapprovalId}`);
}

async function handleWebhook(payload) {
  const topic = payload?.type || payload?.action || payload?.topic;
  const dataId = payload?.data?.id || payload?.id;

  if (!topic || !dataId) {
    return { processed: false, reason: 'Payload inválido.' };
  }

  if (topic.includes('payment') || topic === 'payment.created' || topic === 'payment.updated') {
    const payment = await getPayment(dataId);
    return {
      processed: true,
      event: topic,
      payment,
    };
  }

  if (topic.includes('preapproval') || topic.includes('subscription')) {
    const preapproval = await getPreapproval(dataId);
    return {
      processed: true,
      event: topic,
      subscription: {
        provider: 'mercadopago',
        external_subscription_id: String(preapproval.id),
        status: preapproval.status,
        email: preapproval.payer_email,
      },
    };
  }

  return { processed: false, reason: `Evento não tratado: ${topic}` };
}

async function testConnection() {
  const config = await getConfig();
  if (!config.access_token) {
    throw new Error('Configure access_token para testar o Mercado Pago.');
  }
  const response = await fetch(`${getBaseUrl()}/users/me`, {
    headers: { Authorization: `Bearer ${config.access_token}` },
  });
  if (!response.ok) {
    throw new Error(`Falha na conexão Mercado Pago (${response.status}).`);
  }
  const data = await response.json();
  return { ok: true, nickname: data.nickname || data.id };
}

module.exports = {
  getConfig,
  createPixPayment,
  getPayment,
  createPreapproval,
  getPreapproval,
  handleWebhook,
  formatPayment,
  mapPaymentStatus,
  testConnection,
};
