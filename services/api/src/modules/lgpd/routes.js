const { Router } = require('express');
const { getLgpdService } = require('../../../services/lgpd-service');

const router = Router();

router.get('/export', async (req, res) => {
  try {
    const data = await getLgpdService().exportUserData(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

router.post('/deletion-request', async (req, res) => {
  try {
    const data = await getLgpdService().requestDeletion(req.user.id, {
      reason: req.body?.reason,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
