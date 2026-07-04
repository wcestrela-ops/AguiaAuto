const { Router } = require('express');
const firebase = require('../../services/firebase');

const router = Router();

router.post('/token', async (req, res) => {
  try {
    const { token, device_name, platform = 'web' } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Campo "token" obrigatório.' });
    }

    const device = await firebase.registerToken(req.user.id, { token, device_name, platform });
    res.status(201).json({
      success: true,
      data: device,
      message: 'Dispositivo registrado para notificações push.',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Campo "token" obrigatório.' });
    }

    await firebase.unregisterToken(req.user.id, token);
    res.json({ success: true, message: 'Dispositivo removido.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/dispositivos', async (req, res) => {
  try {
    const devices = await firebase.listDevices(req.user.id);
    res.json({ success: true, data: devices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/teste', async (req, res) => {
  try {
    const result = await firebase.sendPushToUser(req.user.id, {
      title: 'Águia Gestão Veicular',
      body: 'Notificações push funcionando! 🔔',
      data: { type: 'test' },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
