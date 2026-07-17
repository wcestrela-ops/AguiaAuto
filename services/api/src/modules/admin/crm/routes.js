const { Router } = require('express');
const adminAuth = require('../../../middleware/admin-auth');
const { requirePermission } = require('../../../middleware/admin-auth');
const { getCrmLeadService } = require('../../../services/crm-lead-service');
const { getAuditService } = require('../../../services/audit-service');
const { LEAD_STATUSES } = require('../../../db/migrate-phase15-crm-leads');

const router = Router();

router.get('/leads', adminAuth, requirePermission('crm.view'), async (req, res) => {
  try {
    const data = await getCrmLeadService().listLeads(req.tenantId, {
      status: req.query.status,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ success: true, data, meta: { statuses: LEAD_STATUSES } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
  }
});

router.get('/leads/:id', adminAuth, requirePermission('crm.view'), async (req, res) => {
  try {
    const data = await getCrmLeadService().getLead(req.tenantId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message, code: err.code });
  }
});

router.post('/leads', adminAuth, requirePermission('crm.manage'), async (req, res) => {
  try {
    const data = await getCrmLeadService().createLead(req.tenantId, req.body || {});
    await getAuditService().adminAction('crm.lead.create', {
      resourceType: 'crm_lead',
      resourceId: String(data.id),
      req,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message, code: err.code });
  }
});

router.patch('/leads/:id', adminAuth, requirePermission('crm.manage'), async (req, res) => {
  try {
    const data = await getCrmLeadService().updateLead(req.tenantId, req.params.id, req.body || {});
    await getAuditService().adminAction('crm.lead.update', {
      resourceType: 'crm_lead',
      resourceId: String(data.id),
      metadata: { status: data.status },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message, code: err.code });
  }
});

router.delete('/leads/:id', adminAuth, requirePermission('crm.manage'), async (req, res) => {
  try {
    const data = await getCrmLeadService().deleteLead(req.tenantId, req.params.id);
    await getAuditService().adminAction('crm.lead.delete', {
      resourceType: 'crm_lead',
      resourceId: String(req.params.id),
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message, code: err.code });
  }
});

module.exports = router;
