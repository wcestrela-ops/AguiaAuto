const { Router } = require('express');
const { getFinanceiroService } = require('../../../services/financeiro-service');
const { getAuditService } = require('../../../services/audit-service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await getFinanceiroService().listPlansAdmin();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = await getFinanceiroService().createPlan(req.body);
    await getAuditService().adminAction('plan.create', {
      resourceType: 'plan',
      resourceId: data.id,
      metadata: { name: data.name, price_monthly: data.price_monthly, active: data.active },
      req,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const data = await getFinanceiroService().updatePlan(req.params.id, req.body);
    await getAuditService().adminAction('plan.update', {
      resourceType: 'plan',
      resourceId: data.id,
      metadata: { name: data.name, price_monthly: data.price_monthly, active: data.active },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
