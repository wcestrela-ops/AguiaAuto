const { Router } = require('express');
const {
  getWhatsAppService,
  getRepository,
  listProviderTypes,
  maskProvider,
  getProviderSchema,
} = require('@aguia/whatsapp');

const router = Router();

function stripMaskedSecrets(body, current) {
  const cleaned = { ...body };
  const secretFields = ['api_key', 'access_token', 'app_secret', 'verify_token'];

  for (const field of secretFields) {
    if (cleaned[field] && String(cleaned[field]).includes('*') && current?.[field]) {
      cleaned[field] = current[field];
    }
  }
  return cleaned;
}

router.get('/types', (req, res) => {
  res.json({ success: true, data: listProviderTypes() });
});

router.get('/', async (req, res) => {
  try {
    const repo = getRepository();
    const providers = await repo.list({ masked: true });
    const primary = providers.find(p => p.is_primary);
    const backup = providers.find(p => p.is_backup);

    res.json({
      success: true,
      data: {
        providers,
        primary: primary ? { id: primary.id, provider: primary.provider } : null,
        backup: backup ? { id: backup.id, provider: backup.provider } : null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { provider } = req.body;
    if (!getProviderSchema(provider)) {
      return res.status(400).json({ success: false, error: 'Tipo de provedor inválido.' });
    }

    const repo = getRepository();
    const created = await repo.create(req.body);
    res.status(201).json({ success: true, data: maskProvider(created) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const repo = getRepository();
    const provider = await repo.findById(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Provedor não encontrado.' });
    }

    res.json({
      success: true,
      data: {
        ...maskProvider(provider),
        fields: getProviderSchema(provider.provider)?.fields.map(({ secret, ...f }) => f),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const repo = getRepository();
    const current = await repo.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Provedor não encontrado.' });
    }

    const data = stripMaskedSecrets(req.body, current);
    const updated = await repo.update(req.params.id, data);
    res.json({ success: true, data: maskProvider(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const repo = getRepository();
    await repo.delete(req.params.id);
    res.json({ success: true, message: 'Provedor removido.' });
  } catch (err) {
    res.status(err.message.includes('não encontrado') ? 404 : 500).json({ success: false, error: err.message });
  }
});

router.put('/:id/primary', async (req, res) => {
  try {
    const repo = getRepository();
    const updated = await repo.setPrimary(req.params.id);
    res.json({ success: true, data: maskProvider(updated), message: 'Provedor principal definido.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id/backup', async (req, res) => {
  try {
    const repo = getRepository();
    const updated = await repo.setBackup(req.params.id);
    res.json({ success: true, data: maskProvider(updated), message: 'Provedor de backup definido.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/test', async (req, res) => {
  try {
    const service = getWhatsAppService();
    const result = await service.testConnection(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/status', async (req, res) => {
  try {
    const service = getWhatsAppService();
    const result = await service.getStatus(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/connect', async (req, res) => {
  try {
    const service = getWhatsAppService();
    const result = await service.connect(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/disconnect', async (req, res) => {
  try {
    const service = getWhatsAppService();
    const result = await service.disconnect(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/qrcode', async (req, res) => {
  try {
    const service = getWhatsAppService();
    const result = await service.generateQrCode(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { type = 'text', to, user, ...payload } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, error: 'Campo "to" é obrigatório.' });
    }

    const service = getWhatsAppService();
    const methods = {
      text: 'sendText',
      image: 'sendImage',
      document: 'sendDocument',
      audio: 'sendAudio',
      video: 'sendVideo',
      location: 'sendLocation',
      contact: 'sendContact',
      buttons: 'sendButtons',
      list: 'sendList',
    };

    const method = methods[type];
    if (!method) {
      return res.status(400).json({ success: false, error: 'Tipo de mensagem inválido.' });
    }

    const result = await service[method]({ to, ...payload }, { user });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
