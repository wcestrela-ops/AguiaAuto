const { Router } = require('express');
const { getSiteContentService } = require('../../services/site-content-service');

const router = Router();

router.get('/landing', async (req, res) => {
  try {
    const data = await getSiteContentService().getLanding();
    if (!data.content.enabled) {
      return res.json({ success: true, data: { ...data, redirect: '/login' } });
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
