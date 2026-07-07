const { Router } = require('express');
const { getReferralService } = require('../../services/referral-service');

const router = Router();

router.get('/resumo', async (req, res) => {
  try {
    const data = await getReferralService().getSummary(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/link', async (req, res) => {
  try {
    const data = await getReferralService().getSummary(req.user.id);
    res.json({
      success: true,
      data: {
        codigo: data.codigo,
        link: data.link,
        desconto_percentual: data.desconto_percentual,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
