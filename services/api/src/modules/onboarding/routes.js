const { Router } = require('express');
const { getOnboardingService } = require('../../services/onboarding-service');
const { authLoginLimiter } = require('../../middleware/rate-limit');
const { getClientIp } = require('../../lib/client-ip');

const router = Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: getOnboardingService().getFlowInfo(),
  });
});

router.post('/cadastro', authLoginLimiter, async (req, res) => {
  try {
    const data = await getOnboardingService().cadastro(req.body, {
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
