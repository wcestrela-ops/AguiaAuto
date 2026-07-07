const { Router } = require('express');
const { getReferralService } = require('../../services/referral-service');

const router = Router();

router.get('/validar/:code', async (req, res) => {
  try {
    const data = await getReferralService().validateCode(req.params.code);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
