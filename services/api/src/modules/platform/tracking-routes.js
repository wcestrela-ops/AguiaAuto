const { Router } = require('express');
const platformAuth = require('../../middleware/platform-auth');
const { requirePlatformPermission } = require('../../middleware/platform-auth');
const { getExternalEntityMappingService } = require('../../services/external-entity-mapping-service');
const { getAuditService } = require('../../services/audit-service');

const router = Router();

router.get('/tenants/:id/tracking-config', platformAuth, requirePlatformPermission('platform.tenants.view'), async (req, res) => {
  try {
    const data = await getExternalEntityMappingService().getTrackingConfig(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/tenants/:id/tracking-config', platformAuth, requirePlatformPermission('platform.tenants.update'), async (req, res) => {
  try {
    const tenantId = Number(req.params.id);
    const data = await getExternalEntityMappingService().updateTrackingConfig(tenantId, req.body || {});
    await getAuditService().adminAction('platform.tenant.tracking_config.update', {
      resourceType: 'tenant_tracking_config',
      resourceId: String(tenantId),
      metadata: req.body,
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/tenants/:id/entity-mappings', platformAuth, requirePlatformPermission('platform.tenants.view'), async (req, res) => {
  try {
    const data = await getExternalEntityMappingService().listForTenant(Number(req.params.id), {
      provider: req.query.provider,
      entityType: req.query.entity_type,
      limit: parseInt(req.query.limit || '100', 10),
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
