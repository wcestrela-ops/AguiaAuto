const { Router } = require('express');
const { getTenantBrandingService } = require('../../services/tenant-branding-service');
const { getCrmLeadService } = require('../../services/crm-lead-service');
const { resolveTenantSlugFromRequest } = require('../../lib/tenant/tenant-resolver');
const { normalizeHost } = require('../../lib/tenant/tenant-host-resolver');
const { DEFAULT_TENANT_ID } = require('../../lib/tenant/tenant-config');

const router = Router();

router.get('/branding', async (req, res) => {
  try {
    const slug = req.query.slug || resolveTenantSlugFromRequest(req);
    let data;
    if (slug) {
      data = await getTenantBrandingService().getBySlug(slug);
    } else {
      data = await getTenantBrandingService().getByHost(req.headers.host);
    }
    if (!data) {
      return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/leads', async (req, res) => {
  try {
    const tenantId = req.tenantId || DEFAULT_TENANT_ID;
    const data = await getCrmLeadService().createPublicLead(tenantId, req.body || {}, {
      host: normalizeHost(req.headers.host),
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

module.exports = router;
