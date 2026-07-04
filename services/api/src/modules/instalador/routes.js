const { Router } = require('express');

const router = Router();

router.get('/agendamentos', (req, res) => {
  res.status(501).json({ success: false, error: 'Área do instalador em desenvolvimento.' });
});

router.post('/instalacoes/:id/finalizar', (req, res) => {
  res.status(501).json({ success: false, error: 'Finalização de instalação em desenvolvimento.' });
});

module.exports = router;
