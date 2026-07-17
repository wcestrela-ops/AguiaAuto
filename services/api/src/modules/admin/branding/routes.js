const { Router } = require('express');
const adminAuth = require('../../../middleware/admin-auth');
const { requirePermission } = require('../../../middleware/admin-auth');
const { getTenantBrandingService } = require('../../../services/tenant-branding-service');
const { getAuditService } = require('../../../services/audit-service');

const router = Router();

router.get('/', adminAuth, requirePermission('settings.manage'), async (req, res) => {
  try {
    const data = await getTenantBrandingService().getById(req.tenantId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/', adminAuth, requirePermission('settings.manage'), async (req, res) => {
  try {
    const data = await getTenantBrandingService().updateBranding(req.tenantId, req.body || {});
    await getAuditService().adminAction('tenant.branding.update', {
      resourceType: 'tenant',
      resourceId: String(req.tenantId),
      metadata: { brand_name: data.brand_name, primary_color: data.primary_color },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
