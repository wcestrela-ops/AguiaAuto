const { Router } = require('express');
const { ALERT_TYPES, ALERT_CHANNELS } = require('@aguia/shared');

const router = Router();

router.get('/tipos', (req, res) => {
  res.json({ success: true, data: { tipos: ALERT_TYPES, canais: ALERT_CHANNELS } });
});

router.get('/', (req, res) => {
  res.status(501).json({ success: false, error: 'Listagem de alertas em desenvolvimento.' });
});

router.post('/', (req, res) => {
  res.status(501).json({ success: false, error: 'Configuração de alertas em desenvolvimento.' });
});

module.exports = router;
