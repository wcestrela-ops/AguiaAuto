const { Router } = require('express');
const platformAuth = require('../../../middleware/platform-auth');
const { requirePlatformPermission } = require('../../../middleware/platform-auth');
const { getTenantIntegrationService } = require('../../../services/tenant-integration-service');
const { getAuditService } = require('../../../services/audit-service');

const router = Router();

router.get('/tenants/:id/integrations', platformAuth, requirePlatformPermission('platform.tenants.view'), async (req, res) => {
  try {
    const data = await getTenantIntegrationService().listForTenant(Number(req.params.id), { masked: true });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/tenants/:id/integrations/:key/mode', platformAuth, requirePlatformPermission('platform.tenants.update'), async (req, res) => {
  try {
    const tenantId = Number(req.params.id);
    const { credential_mode } = req.body || {};
    if (!credential_mode) {
      return res.status(400).json({ success: false, error: 'credential_mode é obrigatório (SHARED ou OWN).' });
    }

    const data = await getTenantIntegrationService().setCredentialMode(
      req.params.key,
      tenantId,
      credential_mode,
    );
    await getAuditService().adminAction('platform.tenant.integration.mode', {
      resourceType: 'integration',
      resourceId: req.params.key,
      metadata: { tenant_id: tenantId, credential_mode },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
