const { Router } = require('express');
const { getOperationalDashboardService } = require('../../../services/operational-dashboard-service');

const router = Router();

router.get('/operations', async (req, res) => {
  try {
    const data = await getOperationalDashboardService().getSummary();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
