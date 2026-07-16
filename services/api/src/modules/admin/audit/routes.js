const { Router } = require('express');
const { getAuditRepository } = require('../../../repositories/audit-repository');

const router = Router();

router.get('/acoes', async (req, res) => {
  try {
    const data = await getAuditRepository().listDistinctActions();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      limit: req.query.limit,
      offset: req.query.offset,
      action: req.query.action || undefined,
      actor_type: req.query.actor_type || undefined,
      resource_type: req.query.resource_type || undefined,
      actor_id: req.query.actor_id || undefined,
    };

    const repo = getAuditRepository();
    const [logs, total] = await Promise.all([
      repo.list(filters),
      repo.count(filters),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        total,
        limit: Math.min(Math.max(parseInt(filters.limit || '50', 10), 1), 200),
        offset: Math.max(parseInt(filters.offset || '0', 10), 0),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
