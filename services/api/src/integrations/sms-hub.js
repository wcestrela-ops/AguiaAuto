const logger = require('../logger');

function getSmsHubConfig() {
  return {
    url: (process.env.SMS_HUB_URL || 'http://localhost:4000').replace(/\/$/, ''),
    secret: process.env.AGUIA_SERVICE_SECRET || process.env.ADMIN_SECRET || '',
  };
}

async function sendTrackerCommand({ phone, message, action, vehicle_id, user_id, source = 'aguia-failover' }) {
  const config = getSmsHubConfig();

  if (!config.secret) {
    throw new Error('AGUIA_SERVICE_SECRET não configurado para envio SMS.');
  }

  const response = await fetch(`${config.url}/api/v1/sms/internal/dispatches/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Aguia-Service-Secret': config.secret,
    },
    body: JSON.stringify({
      phone,
      message,
      action,
      vehicle_id,
      user_id,
      source,
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
