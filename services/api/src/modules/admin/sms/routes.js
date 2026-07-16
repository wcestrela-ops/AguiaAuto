const { Router } = require('express');
const {
  getSmsService,
  getRepository,
  listProviderTypes,
  maskProvider,
  getProviderSchema,
} = require('@aguia/sms');

const router = Router();

function stripMaskedSecrets(body, current) {
  const cleaned = { ...body };
  const secretFields = ['api_key'];

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

router.get('/dispatches', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const vehicleId = req.query.vehicle_id ? parseInt(req.query.vehicle_id, 10) : undefined;
    const data = await getSmsService().listDispatches({ limit, vehicleId });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const repo = getRepository();
    const providers = await repo.list({ masked: true });
    const primary = providers.find((p) => p.is_primary);
    const backup = providers.find((p) => p.is_backup);

    res.json({
      success: true,
      data: {
        providers,
        primary: primary ? { id: primary.id, provider: primary.provider, name: primary.name } : null,
        backup: backup ? { id: backup.id, provider: backup.provider, name: backup.name } : null,
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
      return res.status(400).json({ success: false, error: 'Tipo de gateway inválido.' });
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
      return res.status(404).json({ success: false, error: 'Gateway não encontrado.' });
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
      return res.status(404).json({ success: false, error: 'Gateway não encontrado.' });
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
    res.json({ success: true, message: 'Gateway removido.' });
  } catch (err) {
    res.status(err.message.includes('não encontrado') ? 404 : 500).json({ success: false, error: err.message });
  }
});

router.put('/:id/primary', async (req, res) => {
  try {
    const repo = getRepository();
    const updated = await repo.setPrimary(req.params.id);
    res.json({ success: true, data: maskProvider(updated), message: 'Gateway principal definido.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id/backup', async (req, res) => {
  try {
    const repo = getRepository();
    const updated = await repo.setBackup(req.params.id);
    res.json({ success: true, data: maskProvider(updated), message: 'Gateway de backup definido.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/test', async (req, res) => {
  try {
    const service = getSmsService();
    const result = await service.testConnection(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { to, message, user_id, vehicle_id } = req.body;
    if (!to || !message) {
      return res.status(400).json({ success: false, error: 'Campos "to" e "message" são obrigatórios.' });
    }

    const service = getSmsService();
    const result = await service.sendText({
      to,
      text: message,
      user: user_id,
      vehicleId: vehicle_id,
      action: 'admin.manual',
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
