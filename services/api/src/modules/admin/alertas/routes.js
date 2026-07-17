const { Router } = require('express');
const { getAlertService } = require('../../../services/alert-service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await getAlertService().listAll({ tenantId: req.tenantId });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/config', async (req, res) => {
  try {
    const data = await getAlertService().getEngineConfig({ masked: true });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/teste/:userId', async (req, res) => {
  try {
    const data = await getAlertService().sendTestAlert(req.params.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
