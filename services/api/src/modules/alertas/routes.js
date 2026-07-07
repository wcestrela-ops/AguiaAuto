const { Router } = require('express');
const { getAlertService } = require('../../services/alert-service');

const router = Router();

router.get('/tipos', (req, res) => {
  res.json({ success: true, data: getAlertService().getTypes() });
});

router.get('/preferencias', async (req, res) => {
  try {
    const vehicleId = req.query.vehicle_id ? Number(req.query.vehicle_id) : null;
    const data = await getAlertService().getPreferences(req.user.id, vehicleId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/preferencias', async (req, res) => {
  try {
    const data = await getAlertService().updatePreferences(req.user.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const data = await getAlertService().listForUser(req.user.id, { unreadOnly });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/nao-lidos', async (req, res) => {
  try {
    const count = await getAlertService().getUnreadCount(req.user.id);
    res.json({ success: true, data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/marcar-todos-lidos', async (req, res) => {
  try {
    const data = await getAlertService().markAllRead(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/lido', async (req, res) => {
  try {
    const data = await getAlertService().markRead(req.user.id, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
