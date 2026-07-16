const { Router } = require('express');
const { getEmergencyService } = require('../../services/emergency-service');
const { emergencyTriggerLimiter } = require('../../middleware/rate-limit');

const router = Router();

router.get('/contatos', async (req, res) => {
  try {
    const data = await getEmergencyService().getOverview(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/contatos', async (req, res) => {
  try {
    const contatos = await getEmergencyService().savePersonalContacts(
      req.user.id,
      req.body?.contatos || req.body?.contacts || [],
    );
    res.json({ success: true, data: { contatos_pessoais: contatos } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/acionar', emergencyTriggerLimiter, async (req, res) => {
  try {
    const data = await getEmergencyService().trigger(req.user.id, req.body || {});
    res.json({ success: true, data, message: data.message });
  } catch (err) {
    const status = err.message.includes('Aguarde') ? 429 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
