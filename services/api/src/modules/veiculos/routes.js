const { Router } = require('express');
const { getVehicleService } = require('../../services/vehicle-service');

const router = Router();

function getService() {
  return getVehicleService();
}

router.get('/', async (req, res) => {
  try {
    const data = await getService().listForUser(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await getService().getForUser(req.user.id, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.get('/:id/localizacao', async (req, res) => {
  try {
    const data = await getService().getLocation(req.user.id, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.post('/:id/bloqueio', async (req, res) => {
  try {
    const data = await getService().block(req.user.id, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.post('/:id/desbloqueio', async (req, res) => {
  try {
    const data = await getService().unblock(req.user.id, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
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
