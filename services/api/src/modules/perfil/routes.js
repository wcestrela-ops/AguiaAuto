const { Router } = require('express');

const router = Router();

router.get('/', (req, res) => {
  res.status(501).json({ success: false, error: 'Perfil em desenvolvimento.' });
});

router.put('/senha', (req, res) => {
  res.status(501).json({ success: false, error: 'Alteração de senha em desenvolvimento.' });
});

module.exports = router;
