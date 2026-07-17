const { Router } = require('express');
const { getContractService } = require('../../../services/contract-service');

const router = Router();

router.get('/templates', async (req, res) => {
  try {
    const data = await getContractService().listTemplatesAdmin();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/templates/:slug', async (req, res) => {
  try {
    const { title, body_html } = req.body;
    const data = await getContractService().updateTemplateAdmin(req.params.slug, { title, body_html });
    res.json({ success: true, data, message: 'Modelo de contrato atualizado.' });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.get('/aceites', async (req, res) => {
  try {
    const data = await getContractService().listAcceptancesAdmin(req.tenantId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/aceites/:id/documento', async (req, res) => {
  try {
    const doc = await getContractService().getAcceptanceDocumentAdmin(req.params.id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
    res.send(doc.html);
  } catch (err) {
    const status = err.message.includes('não disponível') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
