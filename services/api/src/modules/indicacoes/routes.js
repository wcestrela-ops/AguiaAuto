const { Router } = require('express');

const router = Router();

router.get('/link', (req, res) => {
  res.status(501).json({ success: false, error: 'Indique e Ganhe em desenvolvimento.' });
});

module.exports = router;
