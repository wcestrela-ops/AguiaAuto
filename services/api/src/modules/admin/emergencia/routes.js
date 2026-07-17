const { Router } = require('express');
const { getEmergencyService } = require('../../../services/emergency-service');

const router = Router();

router.get('/resumo', async (req, res) => {
  try {
    const data = await getEmergencyService().getOperationalStats(req.tenantId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/eventos', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
    const data = await getEmergencyService().listRecentEvents(limit, req.tenantId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
