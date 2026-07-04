const { Router } = require('express');
const { getAuthService } = require('../../services/auth-service');
const { jwtAuth } = require('../../middleware/jwt-auth');

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const data = await getAuthService().register(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const data = await getAuthService().login(req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token: refreshToken } = req.body;
    const data = await auth.refresh(refreshToken);
    res.json({ success: true, data });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refresh_token: refreshToken } = req.body;
    await auth.logout(refreshToken);
    res.json({ success: true, message: 'Logout realizado.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/me', jwtAuth, async (req, res) => {
  try {
    const user = await auth.me(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

module.exports = router;
