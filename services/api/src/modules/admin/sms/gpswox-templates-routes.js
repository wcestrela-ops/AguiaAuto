const { Router } = require('express');
const { getGpswoxSmsTemplateService } = require('../../../services/gpswox-sms-template-service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const data = await getGpswoxSmsTemplateService().listFromGpswox(lang);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { model_id, dry_run, lang } = req.body;
    if (!model_id) {
      return res.status(400).json({ success: false, error: 'model_id é obrigatório.' });
    }

    const data = await getGpswoxSmsTemplateService().importToModel(Number(model_id), {
      dry_run: Boolean(dry_run),
      lang: lang || 'en',
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/push', async (req, res) => {
  try {
    const { model_id, lang, update_existing } = req.body;
    if (!model_id) {
      return res.status(400).json({ success: false, error: 'model_id é obrigatório.' });
    }

    const data = await getGpswoxSmsTemplateService().pushModelToGpswox(Number(model_id), {
      lang: lang || 'en',
      update_existing: update_existing !== false,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
