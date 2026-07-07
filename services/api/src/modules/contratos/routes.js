const { Router } = require('express');
const { getContractService } = require('../../services/contract-service');

const router = Router();

function requestMeta(req) {
  return {
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'] || null,
  };
}

function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

router.get('/status', async (req, res) => {
  try {
    const data = await getContractService().getStatus(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const data = await getContractService().getOverview(req.user.id, baseUrl(req));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/servico/aceitar', async (req, res) => {
  try {
    const data = await getContractService().acceptServiceContract(req.user.id, requestMeta(req));
    res.json({
      success: true,
      data,
      message: data.already_accepted ? 'Contrato já aceito.' : 'Contrato aceito com sucesso.',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/entrega/aceitar', async (req, res) => {
  try {
    const { installation_log_id } = req.body;
    if (!installation_log_id) {
      return res.status(400).json({ success: false, error: 'installation_log_id é obrigatório.' });
    }

    const data = await getContractService().acceptInstallationDelivery(
      req.user.id,
      installation_log_id,
      requestMeta(req)
    );
    res.json({
      success: true,
      data,
      message: data.already_accepted
        ? 'Termo de entrega já aceito.'
        : 'Aceite registrado. Obrigado pela confirmação.',
    });
  } catch (err) {
    const status = err.message.includes('não encontrad') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.get('/fotos/:id', async (req, res) => {
  try {
    const { fullPath, photo } = await getContractService().getPhotoForUser(
      req.user.id,
      req.params.id,
      { role: req.user.role }
    );
    res.sendFile(fullPath, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ success: false, error: 'Falha ao carregar foto.' });
      }
    });
  } catch (err) {
    const status = err.message.includes('negado') ? 403
      : err.message.includes('não encontrad') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

router.get('/documento', async (req, res) => {
  try {
    const { tipo, installation_log_id } = req.query;
    const doc = await getContractService().getDownloadDocument(req.user.id, {
      type: tipo || 'servico',
      installationLogId: installation_log_id ? Number(installation_log_id) : undefined,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
    res.send(doc.html);
  } catch (err) {
    const status = err.message.includes('não assinado') || err.message.includes('indisponível') ? 404 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
