const { Router } = require('express');
const { getTrackerModelRepository } = require('../../../repositories/tracker-model-repository');
const { getTrackerCommandService } = require('../../../services/tracker-command-service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await getTrackerCommandService().listModelsWithCommands();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, manufacturer, protocol, description } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, error: 'Nome do modelo é obrigatório.' });
    }
    const data = await getTrackerModelRepository().createModel(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:modelId', async (req, res) => {
  try {
    const data = await getTrackerModelRepository().updateModel(Number(req.params.modelId), req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.message.includes('não encontrado') ? 404 : 400).json({ success: false, error: err.message });
  }
});

router.delete('/:modelId', async (req, res) => {
  try {
    await getTrackerModelRepository().deleteModel(Number(req.params.modelId));
    res.json({ success: true, message: 'Modelo removido.' });
  } catch (err) {
    res.status(err.message.includes('não encontrado') ? 404 : 400).json({ success: false, error: err.message });
  }
});

router.get('/:modelId/commands', async (req, res) => {
  try {
    const data = await getTrackerModelRepository().listCommands(Number(req.params.modelId));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:modelId/commands', async (req, res) => {
  try {
    const { action_key, label, sms_template } = req.body;
    if (!action_key || !label || !sms_template) {
      return res.status(400).json({
        success: false,
        error: 'action_key, label e sms_template são obrigatórios.',
      });
    }
    const data = await getTrackerModelRepository().createCommand(Number(req.params.modelId), req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:modelId/commands/:commandId', async (req, res) => {
  try {
    const data = await getTrackerModelRepository().updateCommand(Number(req.params.commandId), req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.message.includes('não encontrado') ? 404 : 400).json({ success: false, error: err.message });
  }
});

router.delete('/:modelId/commands/:commandId', async (req, res) => {
  try {
    await getTrackerModelRepository().deleteCommand(Number(req.params.commandId));
    res.json({ success: true, message: 'Comando removido.' });
  } catch (err) {
    res.status(err.message.includes('não encontrado') ? 404 : 400).json({ success: false, error: err.message });
  }
});


module.exports = router;
