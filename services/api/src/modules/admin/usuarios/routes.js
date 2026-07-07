const { Router } = require('express');
const { getUserRepository } = require('../../../repositories/user-repository');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await getUserRepository().listAll();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
