const { Router } = require('express');
const { getInstallerService } = require('../../../services/installer-service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await getInstallerService().listInstallers();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = await getInstallerService().createInstaller(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
