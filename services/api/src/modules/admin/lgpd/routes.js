const { Router } = require('express');
const adminAuth = require('../../../middleware/admin-auth');
const { requirePermission } = require('../../../middleware/admin-auth');
const { getLgpdService } = require('../../../services/lgpd-service');

const router = Router();

router.get('/consents', adminAuth, requirePermission('audit.view'), async (req, res) => {
  try {
    const data = await getLgpdService().listRecentConsents(parseInt(req.query.limit || '50', 10));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/anonymize/:userId', adminAuth, requirePermission('customers.update'), async (req, res) => {
  try {
    const data = await getLgpdService().anonymizeUser(Number(req.params.userId), {
      adminId: req.admin.id,
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
