const { Router } = require('express');
const { getReferralService } = require('../../../services/referral-service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await getReferralService().getAdminOverview();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const data = await getReferralService().syncAllPendingRewards();
    res.json({ success: true, data, message: 'Sincronização de indicações concluída.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
