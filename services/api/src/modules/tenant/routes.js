const { Router } = require('express');
const { getTenantBrandingService } = require('../../services/tenant-branding-service');
const { resolveTenantSlugFromRequest } = require('../../lib/tenant/tenant-resolver');
const { DEFAULT_TENANT_ID } = require('../../lib/tenant/tenant-config');

const router = Router();

router.get('/branding', async (req, res) => {
  try {
    const slug = req.query.slug || resolveTenantSlugFromRequest(req);
    let data;
    if (slug) {
      data = await getTenantBrandingService().getBySlug(slug);
    } else {
      data = await getTenantBrandingService().getById(DEFAULT_TENANT_ID);
    }
    if (!data) {
      return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
