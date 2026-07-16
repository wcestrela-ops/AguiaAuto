const logger = require('../logger');

function getSmsHubConfig() {
  const secret = process.env.AGUIA_SERVICE_SECRET;

  if (!secret) {
    throw new Error(
      'AGUIA_SERVICE_SECRET não configurado. Deve ser distinto do ADMIN_SECRET e nunca exposto ao browser.',
    );
  }

  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ADMIN_SECRET &&
    secret === process.env.ADMIN_SECRET
  ) {
    throw new Error('AGUIA_SERVICE_SECRET não pode ser igual ao ADMIN_SECRET em produção.');
  }

  return {
    url: (process.env.SMS_HUB_URL || 'http://localhost:4000').replace(/\/$/, ''),
    secret,
  };
}

async function sendTrackerCommand({
  phone,
  message,
  action,
  vehicle_id,
  user_id,
  source = 'aguia-failover',
  idempotencyKey,
}) {
  const config = getSmsHubConfig();

  const headers = {
    'Content-Type': 'application/json',
    'X-Aguia-Service-Secret': config.secret,
  };

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const response = await fetch(`${config.url}/api/v1/sms/internal/dispatches/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      phone,
      message,
      action,
      vehicle_id,
      user_id,
      source,
      idempotency_key: idempotencyKey,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const messageText = data?.error?.message || data?.error || `Erro SMS Hub (${response.status})`;
    logger.error('SMS Hub dispatch failed', { status: response.status, message: messageText });
    throw new Error(messageText);
  }

  return data?.data || data;
}

module.exports = { sendTrackerCommand, getSmsHubConfig };
