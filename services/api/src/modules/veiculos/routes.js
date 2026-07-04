const { Router } = require('express');
const gpswox = require('../../integrations/gpswox-gateway');

const router = Router();

router.get('/:id/localizacao', async (req, res) => {
  try {
    const data = await gpswox.getLocation({
      device_id: req.params.id,
      veiculo: req.query.nome,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/bloqueio', async (req, res) => {
  try {
    const data = await gpswox.blockDevice(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/desbloqueio', async (req, res) => {
  try {
    const data = await gpswox.unblockDevice(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/historico', (req, res) => {
  res.status(501).json({ success: false, error: 'Histórico em desenvolvimento.' });
});

router.get('/:id/replay', (req, res) => {
  res.status(501).json({ success: false, error: 'Replay em desenvolvimento.' });
});

router.get('/:id/sensores', (req, res) => {
  res.status(501).json({ success: false, error: 'Sensores em desenvolvimento.' });
});

router.post('/:id/compartilhar', (req, res) => {
  res.status(501).json({ success: false, error: 'Compartilhamento em desenvolvimento.' });
});

module.exports = router;
