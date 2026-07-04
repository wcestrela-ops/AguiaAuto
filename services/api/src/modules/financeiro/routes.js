const { Router } = require('express');

const router = Router();

router.get('/mensalidades', (req, res) => {
  res.status(501).json({ success: false, error: 'Financeiro em desenvolvimento.' });
});

router.get('/faturas', (req, res) => {
  res.status(501).json({ success: false, error: 'Faturas em desenvolvimento.' });
});

router.post('/segunda-via', (req, res) => {
  res.status(501).json({ success: false, error: 'Segunda via em desenvolvimento.' });
});

module.exports = router;
