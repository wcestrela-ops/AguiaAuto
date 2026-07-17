const { Router } = require('express');
const platformAuth = require('../../middleware/platform-auth');
const { requirePlatformPermission } = require('../../middleware/platform-auth');
const { getSaasBillingService } = require('../../services/saas-billing-service');
const { getUsageMeteringService } = require('../../services/usage-metering-service');
const { getAuditService } = require('../../services/audit-service');

const router = Router();

router.get('/saas-plans', platformAuth, requirePlatformPermission('platform.billing.view'), async (req, res) => {
  try {
    const data = await getSaasBillingService().listPlans({
      status: req.query.status || 'ACTIVE',
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/saas-plans/:id', platformAuth, requirePlatformPermission('platform.billing.view'), async (req, res) => {
  try {
    const data = await getSaasBillingService().getPlan(Number(req.params.id));
    if (!data) return res.status(404).json({ success: false, error: 'Plano não encontrado.' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/saas-plans', platformAuth, requirePlatformPermission('platform.billing.manage'), async (req, res) => {
  try {
    const data = await getSaasBillingService().createPlan(req.body || {});
    await getAuditService().adminAction('platform.saas_plan.create', {
      resourceType: 'saas_plan',
      resourceId: String(data.id),
      metadata: { code: data.code, name: data.name },
      req,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch('/saas-plans/:id', platformAuth, requirePlatformPermission('platform.billing.manage'), async (req, res) => {
  try {
    const data = await getSaasBillingService().updatePlan(Number(req.params.id), req.body || {});
    if (!data) return res.status(404).json({ success: false, error: 'Plano não encontrado.' });
    await getAuditService().adminAction('platform.saas_plan.update', {
      resourceType: 'saas_plan',
      resourceId: String(data.id),
      metadata: req.body,
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/saas-plans/:id/modules', platformAuth, requirePlatformPermission('platform.billing.manage'), async (req, res) => {
  try {
    const moduleCodes = req.body?.module_codes || [];
    const data = await getSaasBillingService().setPlanModules(Number(req.params.id), moduleCodes);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/tenants/:id/subscription', platformAuth, requirePlatformPermission('platform.billing.view'), async (req, res) => {
  try {
    const data = await getSaasBillingService().getTenantSubscription(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/tenants/:id/subscriptions', platformAuth, requirePlatformPermission('platform.billing.view'), async (req, res) => {
  try {
    const data = await getSaasBillingService().listTenantSubscriptions(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tenants/:id/subscription', platformAuth, requirePlatformPermission('platform.billing.manage'), async (req, res) => {
  try {
    const tenantId = Number(req.params.id);
    const planId = Number(req.body?.plan_id);
    if (!planId) return res.status(400).json({ success: false, error: 'plan_id é obrigatório.' });

    const data = await getSaasBillingService().assignPlanToTenant(tenantId, planId, req.body || {});
    await getAuditService().adminAction('platform.tenant.subscription.assign', {
      resourceType: 'tenant_saas_subscription',
      resourceId: String(data.subscription.id),
      metadata: { tenant_id: tenantId, plan_id: planId },
      req,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch('/tenants/:id/subscription/:subscriptionId', platformAuth, requirePlatformPermission('platform.billing.manage'), async (req, res) => {
  try {
    const status = req.body?.status;
    if (!status) return res.status(400).json({ success: false, error: 'status é obrigatório.' });

    const data = await getSaasBillingService().updateSubscriptionStatus(
      Number(req.params.subscriptionId),
      status,
    );
    if (!data) return res.status(404).json({ success: false, error: 'Assinatura não encontrada.' });

    await getAuditService().adminAction('platform.tenant.subscription.update', {
      resourceType: 'tenant_saas_subscription',
      resourceId: String(data.id),
      metadata: { status },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/tenants/:id/usage', platformAuth, requirePlatformPermission('platform.billing.view'), async (req, res) => {
  try {
    const data = await getUsageMeteringService().getUsageReport(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/tenants/:id/usage-limits', platformAuth, requirePlatformPermission('platform.billing.manage'), async (req, res) => {
  try {
    const tenantId = Number(req.params.id);
    const data = await getSaasBillingService().setTenantLimits(tenantId, req.body?.limits || req.body || {});
    await getAuditService().adminAction('platform.tenant.usage_limits.update', {
      resourceType: 'tenant_usage_limits',
      resourceId: String(tenantId),
      metadata: req.body,
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/tenants/:id/usage/refresh', platformAuth, requirePlatformPermission('platform.billing.manage'), async (req, res) => {
  try {
    const metrics = await getUsageMeteringService().refreshMetrics(Number(req.params.id));
    res.json({ success: true, data: metrics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
