const { Router } = require('express');

const router = Router();

router.post('/acionar', (req, res) => {
  res.status(501).json({ success: false, error: 'Botão de emergência em desenvolvimento.' });
});

router.get('/contatos', (req, res) => {
  res.json({
    success: true,
    data: {
      policia: '190',
      bombeiros: '193',
      samu: '192',
      assistencia_24h: null,
      seguradora: null,
    },
  });
});

module.exports = router;
