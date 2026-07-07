const { Router } = require('express');
const { getStore, getSchema, maskSettings } = require('@aguia/integrations');

const router = Router();

const SECRET_FIELDS = ['api_key', 'pass', 'secret', 'private_key', 'web_api_key', 'vapid_key', 'access_token', 'app_secret', 'verify_token'];

function stripMaskedSecrets(body, currentSettings) {
  const cleaned = { ...body };
  for (const field of SECRET_FIELDS) {
    if (cleaned[field] && String(cleaned[field]).includes('*') && currentSettings?.[field]) {
      cleaned[field] = currentSettings[field];
    }
    if (cleaned[field] === '') {
      delete cleaned[field];
    }
  }
  return cleaned;
}

router.get('/', async (req, res) => {
  try {
    const store = getStore();
    const integracoes = await store.list({ masked: true });
    res.json({ success: true, data: integracoes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:key', async (req, res) => {
  try {
    const store = getStore();
    const config = await store.get(req.params.key);
    res.json({
      success: true,
      data: {
        ...config,
        settings: maskSettings(req.params.key, config.settings),
        fields: getSchema(req.params.key)?.fields.map(({ secret, env, ...f }) => f),
      },
    });
  } catch (err) {
    res.status(err.message.includes('não existe') ? 404 : 500).json({ success: false, error: err.message });
  }
});

router.put('/:key', async (req, res) => {
  try {
    const store = getStore();
    const current = await store.get(req.params.key, { useCache: false });
    const { settings = {}, enabled } = req.body;
    const cleaned = stripMaskedSecrets(settings, current.settings);
    const updated = await store.update(req.params.key, cleaned, {
      enabled,
      updatedBy: req.headers['x-admin-user'] || 'admin',
    });
    res.json({ success: true, data: updated, message: 'Configuração salva. Serviços recarregarão automaticamente.' });
  } catch (err) {
    res.status(err.message.includes('não existe') ? 404 : 500).json({ success: false, error: err.message });
  }
});

router.post('/reload', async (req, res) => {
  try {
    const store = getStore();
    const integracoes = await store.reload();
    res.json({ success: true, data: integracoes, message: 'Cache de integrações recarregado.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:key/test', async (req, res) => {
  const { key } = req.params;

  try {
    const store = getStore();
    const settings = await store.getSettings(key);

    if (key === 'gpswox') {
      if (!settings.url || !settings.api_hash) {
        return res.status(400).json({
          success: false,
          error: 'Configure url e api_hash para testar o GPSWOX.',
        });
      }
      const url = new URL(`${settings.url.replace(/\/$/, '')}/api/get_devices`);
      url.searchParams.set('user_api_hash', settings.api_hash);
      const response = await fetch(url);
      const ok = response.ok;
      return res.json({
        success: ok,
        message: ok ? 'Conexão GPSWOX OK.' : 'Falha na conexão GPSWOX.',
        status: response.status,
      });
    }

    if (key === 'asaas') {
      if (!settings.api_key) {
        return res.status(400).json({ success: false, error: 'Configure api_key para testar o Asaas.' });
      }
      const base = settings.sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';
      const response = await fetch(`${base}/finance/balance`, {
        headers: { access_token: settings.api_key },
      });
      return res.json({
        success: response.ok,
        message: response.ok ? 'Conexão Asaas OK.' : 'Falha na conexão Asaas.',
        status: response.status,
      });
    }

    if (key === 'mercadopago') {
      const mercadopago = require('../../../integrations/mercadopago');
      const result = await mercadopago.testConnection();
      return res.json({
        success: true,
        message: `Conexão Mercado Pago OK (${result.nickname}).`,
        data: result,
      });
    }

    if (key === 'payment_gateways') {
      const { getPaymentGatewayService } = require('../../../payments/payment-gateway-service');
      const status = await getPaymentGatewayService().getStatus();
      return res.json({
        success: true,
        message: 'Configuração de gateways carregada.',
        data: status,
      });
    }

    if (key === 'firebase') {
      const firebase = require('../../../services/firebase');
      const result = await firebase.testConnection();
      return res.json({ success: true, data: result });
    }

    res.status(400).json({ success: false, error: `Teste automático não disponível para "${key}".` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
