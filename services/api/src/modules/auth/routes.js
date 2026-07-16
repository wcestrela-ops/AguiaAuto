const { Router } = require('express');
const { getAuthService } = require('../../services/auth-service');
const { jwtAuth } = require('../../middleware/jwt-auth');
const { authLoginLimiter } = require('../../middleware/rate-limit');
const { getClientIp } = require('../../lib/client-ip');

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const data = await getAuthService().register(req.body, { ip: getClientIp(req) });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/login', authLoginLimiter, async (req, res) => {
  try {
    const data = await getAuthService().login(req.body, { ip: getClientIp(req) });
    res.json({ success: true, data });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token: refreshToken } = req.body;
    const data = await getAuthService().refresh(refreshToken, { ip: getClientIp(req) });
    res.json({ success: true, data });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refresh_token: refreshToken } = req.body;
    await getAuthService().logout(refreshToken);
    res.json({ success: true, message: 'Logout realizado.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/recuperar-senha/solicitar', async (req, res) => {
  try {
    const { email, channel } = req.body;
    const result = await getAuthService().requestPasswordReset(email, { channel });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/recuperar-senha/confirmar', async (req, res) => {
  try {
    const result = await getAuthService().confirmPasswordReset(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/me', jwtAuth, async (req, res) => {
  try {
    const user = await getAuthService().me(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

module.exports = router;
