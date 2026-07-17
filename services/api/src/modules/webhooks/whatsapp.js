const crypto = require('crypto');
const { getRepository } = require('@aguia/whatsapp');
const { getWebhookEventRepository } = require('../../repositories/webhook-event-repository');
const { enqueue, QUEUE_NAMES } = require('../../infrastructure/queues');
const { isRedisEnabled } = require('../../infrastructure/redis');
const logger = require('../../logger');

function safeEqual(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyMetaSignature(req, appSecret) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !appSecret) return false;

  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  return safeEqual(signature, expected);
}

async function verifyMetaWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  try {
    const repo = getRepository();
    const providers = await repo.list({ masked: false });
    const meta = providers.find((p) => p.provider === 'meta_cloud' && p.enabled);

    if (mode === 'subscribe' && meta?.verify_token && token === meta.verify_token) {
      return res.status(200).send(challenge);
    }

    res.status(403).json({ success: false, error: 'Verificação do webhook falhou.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function receiveMetaWebhook(req, res) {
  try {
    const repo = getRepository();
    const providers = await repo.list({ masked: false });
    const meta = providers.find((p) => p.provider === 'meta_cloud' && p.enabled);

    if (meta?.app_secret) {
      if (!verifyMetaSignature(req, meta.app_secret)) {
        await getWebhookEventRepository().registerEvent({
          provider: 'meta_whatsapp',
          eventId: req.headers['x-hub-message-id'] || null,
          payload: req.body,
        });
        return res.status(401).json({ success: false, error: 'Assinatura Meta inválida.' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ success: false, error: 'Webhook Meta não configurado.' });
    }

    const eventId = req.body?.entry?.[0]?.id || req.headers['x-hub-message-id'] || null;
    const registration = await getWebhookEventRepository().registerEvent({
      provider: 'meta_whatsapp',
      eventId,
      payload: req.body,
    });

    if (registration.duplicate) {
      return res.status(200).json({ success: true, duplicate: true });
    }

    if (isRedisEnabled()) {
      await enqueue(QUEUE_NAMES.NOTIFICATIONS, 'meta-webhook', {
        channel: 'whatsapp',
        payload: { provider: 'meta_cloud', body: req.body },
      });
    }

    res.status(200).json({ success: true, event_uuid: registration.eventUuid });
  } catch (err) {
    logger.warn('Webhook Meta falhou.', { err: err.message, requestId: req.requestId });
    res.status(500).json({ success: false, error: 'Erro ao processar webhook.' });
  }
}

module.exports = { verifyMetaWebhook, receiveMetaWebhook };
