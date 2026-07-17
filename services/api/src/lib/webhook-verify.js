const { timingSafeEqual } = require('crypto');

function safeEqual(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function verifyAsaasWebhook(req, config) {
  const token = req.headers['asaas-access-token'] || req.headers['access_token'];
  const expected = config.webhook_token || config.api_key;
  if (!expected) return process.env.NODE_ENV !== 'production' && process.env.WEBHOOK_ALLOW_UNVERIFIED === 'true';
  return safeEqual(token, expected);
}

function verifyMercadoPagoWebhook(req, config) {
  const secret = config.webhook_secret;
  if (!secret) return process.env.NODE_ENV !== 'production' && process.env.WEBHOOK_ALLOW_UNVERIFIED === 'true';

  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];
  if (!xSignature) return false;

  const parts = String(xSignature).split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  const dataId = req.body?.data?.id || req.body?.id;
  const manifest = `id:${dataId};request-id:${xRequestId || ''};ts:${ts};`;

  const expected = require('crypto')
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  return safeEqual(hash, expected);
}

function verifyGpswoxWebhook(req, config) {
  const secret = config.webhook_secret;
  if (!secret) {
    return process.env.NODE_ENV !== 'production' && process.env.WEBHOOK_ALLOW_UNVERIFIED === 'true';
  }

  const auth = req.headers.authorization || '';
  const headerSecret = req.headers['x-webhook-secret'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : headerSecret;
  return safeEqual(token, secret);
}

function verifyTraccarWebhook(req, config) {
  const secret = config.webhook_secret;
  if (!secret) {
    return process.env.NODE_ENV !== 'production' && process.env.WEBHOOK_ALLOW_UNVERIFIED === 'true';
  }

  const auth = req.headers.authorization || '';
  const headerSecret = req.headers['x-webhook-secret'] || req.headers['x-traccar-secret'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : headerSecret;
  return safeEqual(token, secret);
}

module.exports = {
  safeEqual,
  verifyAsaasWebhook,
  verifyMercadoPagoWebhook,
  verifyGpswoxWebhook,
  verifyTraccarWebhook,
};
