const { Router } = require('express');
const { getAuthService } = require('../../services/auth-service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const user = await getAuthService().me(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await auth.updateProfile(req.user.id, { name, phone });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/senha', async (req, res) => {
  try {
    const result = await auth.changePassword(req.user.id, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
