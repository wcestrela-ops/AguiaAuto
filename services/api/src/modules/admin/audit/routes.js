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

router.get('/recursos', async (req, res) => {
  try {
    const data = await getAuditRepository().listDistinctResourceTypes();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function parseDateFilter(value, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date.toISOString();
}

router.get('/', async (req, res) => {
  try {
    const filters = {
      limit: req.query.limit,
      offset: req.query.offset,
      action: req.query.action || undefined,
      actor_type: req.query.actor_type || undefined,
      resource_type: req.query.resource_type || undefined,
      actor_id: req.query.actor_id || undefined,
      resource_id: req.query.resource_id || undefined,
      search: req.query.search?.trim() || undefined,
      from: parseDateFilter(req.query.from),
      to: parseDateFilter(req.query.to, true),
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
