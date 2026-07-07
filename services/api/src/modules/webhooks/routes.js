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

router.post('/gpswox', (req, res) => {
  res.status(501).json({ success: false, error: 'Webhook GPSWOX em desenvolvimento.' });
});

router.get('/whatsapp/meta', verifyMetaWebhook);
router.post('/whatsapp/meta', receiveMetaWebhook);

module.exports = router;
