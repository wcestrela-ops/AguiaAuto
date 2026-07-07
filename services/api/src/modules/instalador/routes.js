const { Router } = require('express');
const { getInstallerService } = require('../../services/installer-service');

const router = Router();

router.get('/painel', async (req, res) => {
  try {
    const data = await getInstallerService().getDashboard(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/agendamentos', async (req, res) => {
  try {
    const data = await getInstallerService().listPending();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/historico', async (req, res) => {
  try {
    const data = await getInstallerService().listHistory(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/instalacoes/:id', async (req, res) => {
  try {
    const data = await getInstallerService().getJob(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    const status = err.message.includes('não encontrad') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.post('/instalacoes/:id/finalizar', async (req, res) => {
  try {
    const data = await getInstallerService().finalizeInstallation(
      req.user.id,
      req.params.id,
      req.body
    );
    res.json({ success: true, data, message: 'Instalação finalizada. Veículo ativo.' });
  } catch (err) {
    const status = err.message.includes('não encontrad') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
