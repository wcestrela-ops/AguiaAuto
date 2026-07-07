const { Router } = require('express');
const { getFinanceiroService } = require('../../services/financeiro-service');

const router = Router();

router.get('/resumo', async (req, res) => {
  try {
    const data = await getFinanceiroService().getResumo(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/mensalidades', async (req, res) => {
  try {
    const data = await getFinanceiroService().getMensalidades(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/faturas', async (req, res) => {
  try {
    const data = await getFinanceiroService().listFaturas(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/segunda-via', async (req, res) => {
  try {
    const { invoice_id } = req.body;
    if (!invoice_id) {
      return res.status(400).json({ success: false, error: 'invoice_id é obrigatório.' });
    }
    const data = await getFinanceiroService().segundaVia(req.user.id, invoice_id);
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrada') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
