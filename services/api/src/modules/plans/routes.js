const { Router } = require('express');
const { getFinanceiroService } = require('../../services/financeiro-service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await getFinanceiroService().listPlans();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
