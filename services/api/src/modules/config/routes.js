const { Router } = require('express');
const firebase = require('../../services/firebase');

const router = Router();

router.get('/firebase', async (req, res) => {
  try {
    const config = await firebase.getPublicConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(503).json({
      success: false,
      error: 'Firebase não configurado. Configure em Configurações → Integrações.',
    });
  }
});

module.exports = router;
