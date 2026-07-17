const { Router } = require('express');
const adminAuth = require('../../../middleware/admin-auth');
const { requirePermission } = require('../../../middleware/admin-auth');
const { getModuleAccessService } = require('../../../services/module-access-service');

const router = Router();

router.get('/modules', adminAuth, requirePermission('modules.view'), async (req, res) => {
  try {
    const modules = await getModuleAccessService().getActiveModules(req.tenantId);
    res.json({ success: true, data: modules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
