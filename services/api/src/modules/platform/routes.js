const { Router } = require('express');
const platformAuth = require('../../../middleware/platform-auth');
const { requirePlatformPermission } = require('../../../middleware/platform-auth');
const { getTenantRepository } = require('../../../repositories/tenant-repository');
const { getModuleRepository } = require('../../../repositories/module-repository');
const { getHealthReport } = require('../../../infrastructure/health-service');
const { getAllQueueStats } = require('../../../infrastructure/queues');
const { getAuditService } = require('../../../services/audit-service');

const saasRoutes = require('./saas-routes');

const router = Router();

router.use(saasRoutes);

router.get('/health', platformAuth, requirePlatformPermission('platform.health.view'), async (req, res) => {
  try {
    const [health, queues] = await Promise.all([
      getHealthReport(),
      getAllQueueStats(),
    ]);
    res.json({
      success: true,
      data: { health, queues, generated_at: new Date().toISOString() },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/tenants', platformAuth, requirePlatformPermission('platform.tenants.view'), async (req, res) => {
  try {
    const tenants = await getTenantRepository().listAll(parseInt(req.query.limit || '50', 10));
    res.json({ success: true, data: tenants });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/tenants/:id', platformAuth, requirePlatformPermission('platform.tenants.view'), async (req, res) => {
  try {
    const tenant = await getTenantRepository().findById(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });
    const modules = await getModuleRepository().listTenantModulesAdmin(tenant.id);
    res.json({ success: true, data: { ...tenant, modules } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tenants', platformAuth, requirePlatformPermission('platform.tenants.create'), async (req, res) => {
  try {
    const tenant = await getTenantRepository().create(req.body || {});
    await getAuditService().adminAction('platform.tenant.create', {
      resourceType: 'tenant',
      resourceId: String(tenant.id),
      metadata: { slug: tenant.slug },
      req,
    });
    res.status(201).json({ success: true, data: tenant });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch('/tenants/:id', platformAuth, requirePlatformPermission('platform.tenants.update'), async (req, res) => {
  try {
    const tenant = await getTenantRepository().update(req.params.id, req.body || {});
    if (!tenant) return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });
    await getAuditService().adminAction('platform.tenant.update', {
      resourceType: 'tenant',
      resourceId: String(tenant.id),
      metadata: req.body,
      req,
    });
    res.json({ success: true, data: tenant });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/tenants/:id/suspend', platformAuth, requirePlatformPermission('platform.tenants.suspend'), async (req, res) => {
  try {
    const tenant = await getTenantRepository().update(req.params.id, { status: 'SUSPENDED', active: false });
    if (!tenant) return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });
    await getAuditService().adminAction('platform.tenant.suspend', {
      resourceType: 'tenant',
      resourceId: String(tenant.id),
      req,
    });
    res.json({ success: true, data: tenant });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/modules', platformAuth, requirePlatformPermission('platform.modules.view'), async (req, res) => {
  try {
    const modules = await getModuleRepository().listCatalog();
    res.json({ success: true, data: modules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tenants/:id/modules/:code/activate', platformAuth, requirePlatformPermission('platform.modules.manage'), async (req, res) => {
  try {
    const data = await getModuleRepository().activateModuleForTenant(
      Number(req.params.id),
      req.params.code,
      { source: req.body?.source || 'MANUAL' },
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/tenants/:id/modules/:code/suspend', platformAuth, requirePlatformPermission('platform.modules.manage'), async (req, res) => {
  try {
    const data = await getModuleRepository().suspendModuleForTenant(Number(req.params.id), req.params.code);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
