const { Router } = require('express');
const { getSiteContentService } = require('../../../services/site-content-service');
const { getAuditService } = require('../../../services/audit-service');

const router = Router();

router.get('/landing', async (req, res) => {
  try {
    const data = await getSiteContentService().getLanding();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/landing', async (req, res) => {
  try {
    const updatedBy = req.headers['x-admin-user'] || 'admin';
    const data = await getSiteContentService().updateLanding(req.body?.content || req.body, updatedBy);

    await getAuditService().adminAction('site.landing.update', {
      resourceType: 'site',
      resourceId: 'landing',
      metadata: {
        brand_name: data.content.brand_name,
        enabled: data.content.enabled,
        features_count: data.content.features?.length || 0,
      },
      req,
    });

    res.json({ success: true, data, message: 'Landing page atualizada.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
