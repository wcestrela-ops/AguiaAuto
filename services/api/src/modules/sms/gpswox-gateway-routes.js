const { Router } = require('express');
const { timingSafeEqual } = require('crypto');
const { getStore } = require('@aguia/integrations');
const sms = require('../../services/sms');
const logger = require('../../logger');

const router = Router();

router.use(require('express').urlencoded({ extended: false }));

function safeEqual(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function getGatewayAuth() {
  const store = getStore();
  let config = { enabled: true, settings: {} };

  try {
    config = await store.get('sms_gpswox_gateway');
  } catch {
    // Integração ainda não cadastrada — usa variáveis de ambiente
  }

  const settings = config.settings || {};
  return {
    enabled: config.enabled !== false,
    username: settings.username || process.env.SMS_GPSWOX_GATEWAY_USER || '',
    password: settings.password || process.env.SMS_GPSWOX_GATEWAY_PASSWORD || '',
    public_base_url: settings.public_base_url
      || process.env.SMS_GPSWOX_GATEWAY_PUBLIC_URL
      || process.env.APP_PUBLIC_URL
      || '',
  };
}

function extractParams(req) {
  const q = req.query || {};
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  return {
    number: q.number || q.NUMBER || q.phone || q.msisdn
      || b.number || b.NUMBER || b.phone || b.msisdn,
    message: q.message || q.MESSAGE || q.text || q.msg
      || b.message || b.MESSAGE || b.text || b.msg,
    username: q.username || q.user || q.login
      || b.username || b.user || b.login,
    password: q.password || q.pass || q.secret
      || b.password || b.pass || b.secret,
  };
}

function buildPublicBase(auth, req) {
  if (auth.public_base_url) {
    return auth.public_base_url.replace(/\/$/, '');
  }
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  if (host) return `${proto}://${host}`.replace(/\/$/, '');
  return `http://localhost:${process.env.API_PORT || 3000}`;
}

async function handleGpswoxGatewaySend(req, res) {
  try {
    const auth = await getGatewayAuth();
    const { number, message, username, password } = extractParams(req);

    if (!auth.enabled) {
      return res.status(503).json({ success: false, error: 'Gateway SMS GPSWOX desabilitado.' });
    }

    if (auth.username && !safeEqual(username, auth.username)) {
      return res.status(401).json({ success: false, error: 'Usuário inválido.' });
    }

    if (auth.password && !safeEqual(password, auth.password)) {
      return res.status(401).json({ success: false, error: 'Senha inválida.' });
    }

    if (!number || !message) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros number e message são obrigatórios (%NUMBER%, %MESSAGE%).',
      });
    }

    const result = await sms.sendTrackerCommand({
      phone: number,
      message,
      source: 'gpswox-http-gateway',
      action: 'gpswox.gateway',
    });

    logger.info('SMS via gateway GPSWOX HTTP', { number, status: result.status });

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Falha gateway SMS GPSWOX', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

router.get('/send', handleGpswoxGatewaySend);
router.post('/send', handleGpswoxGatewaySend);

router.get('/info', async (req, res) => {
  try {
    const auth = await getGatewayAuth();
    const base = buildPublicBase(auth, req);
    const user = auth.username || 'USER';
    const example = `${base}/v1/sms/gateway/send?username=${encodeURIComponent(user)}&password=PASSWORD&number=%NUMBER%&message=%MESSAGE%`;

    res.json({
      success: true,
      data: {
        enabled: auth.enabled,
        variables: ['%NUMBER%', '%MESSAGE%'],
        example_url: example,
        outbound_template: 'http://SMS_GATEWAY/sendsms.php?username=USER&password=PASSWORD&number=%NUMBER%&message=%MESSAGE%',
        gpswox_help: 'Cole example_url em GPSWOX → Configurações → Gateway SMS/WhatsApp. Credenciais em Integrações → Gateway SMS GPSWOX (entrada).',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
