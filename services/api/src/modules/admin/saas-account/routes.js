const { Router } = require('express');
const adminAuth = require('../../../middleware/admin-auth');
const { requirePermission } = require('../../../middleware/admin-auth');
const { getSaasBillingService } = require('../../../services/saas-billing-service');
const { getUsageMeteringService } = require('../../../services/usage-metering-service');

const router = Router();

router.get('/subscription', adminAuth, requirePermission('billing.view'), async (req, res) => {
  try {
    const data = await getSaasBillingService().getTenantSubscription(req.tenantId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/usage', adminAuth, requirePermission('billing.view'), async (req, res) => {
  try {
    const data = await getUsageMeteringService().getUsageReport(req.tenantId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
