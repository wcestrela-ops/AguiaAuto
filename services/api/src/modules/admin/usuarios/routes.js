const { Router } = require('express');
const { getUserRepository } = require('../../../repositories/user-repository');
const { getAdminClientService } = require('../../../services/admin-client-service');
const { getAuditService } = require('../../../services/audit-service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await getUserRepository().listAll(req.tenantId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/painel/resumo', async (req, res) => {
  try {
    const days = req.query.inactive_access_days;
    const data = await getAdminClientService().getPanelSummary(days);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/painel', async (req, res) => {
  try {
    const data = await getAdminClientService().listClients({
      q: req.query.q,
      active: req.query.active,
      provisioning_status: req.query.provisioning_status,
      never_accessed: req.query.never_accessed,
      access_inactive_days: req.query.access_inactive_days,
      sort: req.query.sort,
      limit: req.query.limit,
      offset: req.query.offset,
      tenantId: req.tenantId,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await getAdminClientService().getClientDetail(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, phone, active } = req.body;
    const data = await getAdminClientService().updateClient(req.params.id, {
      name: name?.trim() || undefined,
      phone: phone?.trim() || undefined,
      active: active === undefined ? undefined : Boolean(active),
    });

    await getAuditService().adminAction('client.update', {
      resourceType: 'user',
      resourceId: data.id,
      metadata: { name: data.name, phone: data.phone, active: data.active },
      req,
    });

    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
