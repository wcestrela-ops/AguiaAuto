const { Router } = require('express');
const asaas = require('../../integrations/asaas');
const { verifyMetaWebhook, receiveMetaWebhook } = require('./whatsapp');

const router = Router();

router.post('/asaas', async (req, res) => {
  try {
    const result = await asaas.handleWebhook(req.body);
    res.json({ success: true, data: result });
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
