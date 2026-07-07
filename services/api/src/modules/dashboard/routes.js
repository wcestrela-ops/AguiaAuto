const { Router } = require('express');
const { getDashboard } = require('../../services/dashboard-service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await getDashboard(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
