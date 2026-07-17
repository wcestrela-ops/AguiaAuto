const { Router } = require('express');
const asaas = require('../../integrations/asaas');
const mercadopago = require('../../integrations/mercadopago');
const { getFinanceiroService } = require('../../services/financeiro-service');
const { enqueue, QUEUE_NAMES } = require('../../infrastructure/queues');
const { getWebhookEventRepository } = require('../../repositories/webhook-event-repository');
const { verifyMetaWebhook, receiveMetaWebhook } = require('./whatsapp');
const {
  verifyAsaasWebhook,
  verifyMercadoPagoWebhook,
  verifyGpswoxWebhook,
  verifyTraccarWebhook,
} = require('../../lib/webhook-verify');

const router = Router();

async function processBillingWebhookAsync(provider, event, payment, payload) {
  const registration = await getWebhookEventRepository().registerEvent({
    provider,
    eventId: payment?.id || event,
    payload: payload || { provider, event, payment },
  });
  if (registration.duplicate) {
    return { duplicate: true, event_uuid: registration.eventUuid };
  }

  if (isRedisEnabled()) {
    await enqueue(QUEUE_NAMES.BILLING_WEBHOOK, `${provider}:${event}`, {
      provider,
      event,
      payment,
    });
    return { queued: true, provider, event, event_uuid: registration.eventUuid };
  }

  const result = await getFinanceiroService().processWebhookEvent({ provider, event, payment });
  await getWebhookEventRepository().markProcessed(registration.id);
  return result;
}

router.post('/asaas', async (req, res) => {
  try {
    const config = await asaas.getConfig();
    if (!verifyAsaasWebhook(req, config)) {
      return res.status(401).json({ success: false, error: 'Webhook Asaas não autorizado.' });
    }

    const parsed = await asaas.handleWebhook(req.body);
    if (!parsed.processed) {
      return res.json({ success: true, data: parsed });
    }

    const result = await processBillingWebhookAsync('asaas', parsed.event, parsed.payment);

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/mercadopago', async (req, res) => {
  try {
    const config = await mercadopago.getConfig();
    if (!verifyMercadoPagoWebhook(req, config)) {
      return res.status(401).json({ success: false, error: 'Webhook Mercado Pago não autorizado.' });
    }

    const parsed = await mercadopago.handleWebhook(req.body);
    if (!parsed.processed) {
      return res.json({ success: true, data: parsed });
    }

    if (parsed.payment) {
      const result = await processBillingWebhookAsync('mercadopago', parsed.event, parsed.payment);
      return res.json({ success: true, data: result });
    }

    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/traccar', async (req, res) => {
  try {
    const { getAlertService } = require('../../services/alert-service');
    const config = await getAlertService().getTraccarWebhookConfig();

    if (!verifyTraccarWebhook(req, config)) {
      return res.status(401).json({ success: false, error: 'Webhook Traccar não autorizado.' });
    }

    const result = await getAlertService().processTraccarWebhook(req.body);

    const { getAnchorService } = require('../../services/anchor-service');
    const anchorPayload = {
      ...req.body,
      device_id: req.body?.event?.deviceId || req.body?.deviceId || req.body?.device_id,
      deviceId: req.body?.event?.deviceId || req.body?.deviceId,
    };
    const anchorResult = await getAnchorService().evaluateFromWebhook(anchorPayload);

    res.json({ success: true, data: { ...result, ancora: anchorResult } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/gpswox', async (req, res) => {
  try {
    const { getAlertService } = require('../../services/alert-service');
    const config = await getAlertService().getEngineConfig();

    if (!verifyGpswoxWebhook(req, config)) {
      return res.status(401).json({ success: false, error: 'Webhook GPSWOX não autorizado.' });
    }

    const result = await getAlertService().processGpswoxWebhook(req.body);

    const { getAnchorService } = require('../../services/anchor-service');
    const anchorResult = await getAnchorService().evaluateFromWebhook(req.body);

    res.json({ success: true, data: { ...result, ancora: anchorResult } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/whatsapp/meta', verifyMetaWebhook);
router.post('/whatsapp/meta', receiveMetaWebhook);

module.exports = router;
