const { Router } = require('express');
const { getStore, getSchema, maskSettings } = require('@aguia/integrations');
const { getAuditService } = require('../../../services/audit-service');

const router = Router();

const SECRET_FIELDS = ['api_key', 'pass', 'secret', 'private_key', 'web_api_key', 'vapid_key', 'access_token', 'app_secret', 'verify_token', 'api_token', 'api_hash', 'password'];

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

    if (req.params.key === 'rastreamento' && cleaned.provider === 'traccar') {
      const traccar = await store.get('traccar', { useCache: false });
      const ts = traccar.settings || {};
      const hasAuth = Boolean(ts.api_token || (ts.email && ts.password));
      if (!ts.url || !hasAuth) {
        return res.status(400).json({
          success: false,
          error: 'Configure Traccar (URL + e-mail/senha ou token API) antes de selecioná-lo como plataforma ativa.',
        });
      }
    }

    const updated = await store.update(req.params.key, cleaned, {
      enabled,
      updatedBy: req.headers['x-admin-user'] || 'admin',
    });
    await getAuditService().adminAction('integration.update', {
      resourceType: 'integration',
      resourceId: req.params.key,
      metadata: { enabled: updated.enabled },
      req,
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
    await getAuditService().adminAction('integration.reload', {
      resourceType: 'integration',
      metadata: { count: integracoes?.length },
      req,
    });
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

    if (key === 'traccar') {
      if (!settings.url) {
        return res.status(400).json({
          success: false,
          error: 'Configure a URL do Traccar para testar.',
        });
      }
      const hasAuth = Boolean(settings.api_token || (settings.email && settings.password));
      if (!hasAuth) {
        return res.status(400).json({
          success: false,
          error: 'Configure e-mail/senha ou token API do Traccar.',
        });
      }

      const baseUrl = settings.url.replace(/\/$/, '');
      const headers = settings.api_token
        ? { Authorization: `Bearer ${settings.api_token}` }
        : { Authorization: `Basic ${Buffer.from(`${settings.email}:${settings.password}`).toString('base64')}` };

      const healthRes = await fetch(`${baseUrl}/api/health`, { headers });
      if (!healthRes.ok) {
        return res.json({
          success: false,
          message: `Health check Traccar falhou (${healthRes.status}).`,
          status: healthRes.status,
        });
      }

      const devicesUrl = new URL(`${baseUrl}/api/devices`);
      devicesUrl.searchParams.set('limit', '1');
      const devicesRes = await fetch(devicesUrl, { headers });
      return res.json({
        success: devicesRes.ok,
        message: devicesRes.ok ? 'Conexão Traccar OK.' : 'Autenticação Traccar falhou.',
        status: devicesRes.status,
      });
    }

    if (key === 'rastreamento') {
      const provider = settings.provider || 'gpswox';
      if (provider === 'traccar') {
        const traccar = await store.getSettings('traccar');
        const hasAuth = Boolean(traccar.api_token || (traccar.email && traccar.password));
        if (!traccar.url || !hasAuth) {
          return res.status(400).json({
            success: false,
            error: 'Traccar não está configurado. Configure credenciais antes de ativar.',
          });
        }
      }
      return res.json({
        success: true,
        message: `Plataforma de rastreamento ativa: ${provider === 'traccar' ? 'Traccar' : 'GPSWOX'}.`,
        data: { provider },
      });
    }

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

    if (key === 'alertas') {
      const { getAlertService } = require('../../../services/alert-service');
      const config = await getAlertService().getEngineConfig();
      return res.json({
        success: true,
        message: config.enabled ? 'Motor de alertas ativo.' : 'Motor de alertas desativado.',
        data: config,
      });
    }

    if (key === 'firebase') {
      const firebase = require('../../../services/firebase');
      const result = await firebase.testConnection();
      return res.json({ success: true, data: result });
    }

    if (key === 'smtp') {
      const emailService = require('../../../services/email');
      const result = await emailService.testConnection();
      return res.json({
        success: true,
        message: `Conexão SMTP OK (${result.host}).`,
        data: result,
      });
    }

    if (key === 'cobranca') {
      const { getBillingReminderService } = require('../../../services/billing-reminder-service');
      const { getBillingConfig, getEnabledReminderOffsets } = require('../../../lib/billing-templates');
      const settings = await getBillingConfig();
      const status = await getBillingReminderService().getStatus();
      const offsets = getEnabledReminderOffsets(settings);
      return res.json({
        success: true,
        message: `Cobrança configurada. Lembretes nos dias: ${offsets.map((o) => o.days).join(', ') || 'nenhum'}.`,
        data: status,
      });
    }

    res.status(400).json({ success: false, error: `Teste automático não disponível para "${key}".` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
