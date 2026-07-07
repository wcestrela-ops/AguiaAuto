const { Router } = require('express');
const asaas = require('../../integrations/asaas');
const mercadopago = require('../../integrations/mercadopago');
const { getFinanceiroService } = require('../../services/financeiro-service');
const { verifyMetaWebhook, receiveMetaWebhook } = require('./whatsapp');

const router = Router();

router.post('/asaas', async (req, res) => {
  try {
    const parsed = await asaas.handleWebhook(req.body);
    if (!parsed.processed) {
      return res.json({ success: true, data: parsed });
    }

    const result = await getFinanceiroService().processWebhookEvent({
      provider: 'asaas',
      event: parsed.event,
      payment: parsed.payment,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/mercadopago', async (req, res) => {
  try {
    const parsed = await mercadopago.handleWebhook(req.body);
    if (!parsed.processed) {
      return res.json({ success: true, data: parsed });
    }

    if (parsed.payment) {
      const result = await getFinanceiroService().processWebhookEvent({
        provider: 'mercadopago',
        event: parsed.event,
        payment: parsed.payment,
      });
      return res.json({ success: true, data: result });
    }

    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/gpswox', async (req, res) => {
  try {
    const { getAlertService } = require('../../services/alert-service');
    const config = await getAlertService().getEngineConfig();

    if (config.webhook_secret) {
      const auth = req.headers['authorization'] || '';
      const headerSecret = req.headers['x-webhook-secret'] || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : headerSecret;
      if (token !== config.webhook_secret) {
        return res.status(401).json({ success: false, error: 'Webhook não autorizado.' });
      }
    }

    const result = await getAlertService().processGpswoxWebhook(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/whatsapp/meta', verifyMetaWebhook);
router.post('/whatsapp/meta', receiveMetaWebhook);

module.exports = router;
