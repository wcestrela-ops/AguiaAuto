const { Router } = require('express');
const platformAuth = require('../../middleware/platform-auth');
const { requirePlatformPermission } = require('../../middleware/platform-auth');
const { getTenantOnboardingService } = require('../../services/tenant-onboarding-service');
const { getSaasBillingService } = require('../../services/saas-billing-service');
const { getAuditService } = require('../../services/audit-service');

const router = Router();

router.get('/schema', platformAuth, requirePlatformPermission('platform.tenants.view'), (req, res) => {
  res.json({ success: true, data: getTenantOnboardingService().getSchema() });
});

router.get('/plans', platformAuth, requirePlatformPermission('platform.billing.view'), async (req, res) => {
  try {
    const data = await getSaasBillingService().listPlans({ status: 'ACTIVE' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tenants', platformAuth, requirePlatformPermission('platform.tenants.create'), async (req, res) => {
  try {
    const data = await getTenantOnboardingService().onboardTenant(req.body || {}, {
      createdBy: req.admin?.id,
    });
    await getAuditService().adminAction('platform.tenant.onboarding', {
      resourceType: 'tenant',
      resourceId: String(data.tenant.id),
      metadata: {
        slug: data.tenant.slug,
        plan_id: data.plan?.id,
        owner_email: data.owner.email,
      },
      req,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
