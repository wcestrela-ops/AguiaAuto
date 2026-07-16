const { Router } = require('express');
const { getVehicleService } = require('../../services/vehicle-service');
const { getAnchorService } = require('../../services/anchor-service');

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

router.get('/comandos', (req, res) => {
  res.json({ success: true, data: getService().listCommands() });
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

router.get('/:id/ancora', async (req, res) => {
  try {
    const data = await getAnchorService().getForUser(req.user.id, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.post('/:id/ancora', async (req, res) => {
  try {
    const radius = req.body?.radius_meters ? parseInt(req.body.radius_meters, 10) : undefined;
    const data = await getAnchorService().activate(req.user.id, req.params.id, { radius_meters: radius });
    res.json({ success: true, data, message: data.message });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.delete('/:id/ancora', async (req, res) => {
  try {
    const data = await getAnchorService().deactivate(req.user.id, req.params.id);
    res.json({ success: true, data, message: data.message });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
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
    res.json({ success: true, data, message: data.message || 'Bloqueio enviado.' });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.post('/:id/desbloqueio', async (req, res) => {
  try {
    const data = await getService().unblock(req.user.id, req.params.id);
    res.json({ success: true, data, message: data.message || 'Desbloqueio enviado.' });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.post('/:id/comandos/:action', async (req, res) => {
  try {
    const data = await getService().runCommand(req.user.id, req.params.id, req.params.action);
    res.json({
      success: true,
      data,
      message: data.message || `${data.label} enviado.`,
    });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.get('/:id/historico', async (req, res) => {
  try {
    const { from, to, hours } = req.query;
    const data = await getService().getHistory(req.user.id, req.params.id, {
      from,
      to,
      hours: hours ? parseInt(hours, 10) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.post('/:id/compartilhar', async (req, res) => {
  try {
    const duration = req.body?.duration_minutes || 60;
    const data = await getService().shareLocation(req.user.id, req.params.id, {
      duration_minutes: duration,
    });
    res.json({ success: true, data, message: 'Link de compartilhamento GPSWOX gerado.' });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.get('/:id/replay', (req, res) => {
  res.status(501).json({ success: false, error: 'Replay em desenvolvimento. Use /historico.' });
});

router.get('/:id/sensores', (req, res) => {
  res.status(501).json({ success: false, error: 'Sensores em desenvolvimento.' });
});

module.exports = router;
