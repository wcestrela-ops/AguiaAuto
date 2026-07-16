const { Router } = require('express');
const { getAuditRepository } = require('../../../repositories/audit-repository');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const data = await getAuditRepository().listRecent(limit);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
