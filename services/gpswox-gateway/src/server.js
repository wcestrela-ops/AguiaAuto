require('dotenv').config();

const express = require('express');
const logger = require('./logger');
const { closeBrowser } = require('./browser');
const { getGatewayConfig } = require('./config/provider');
const { getStore } = require('@aguia/integrations');
const {
  getLocation,
  blockDevice,
  unblockDevice,
  sendCommand,
  createCliente,
  createVeiculo,
  getHistory,
  createSharing,
  listDevices,
} = require('./services/tracking');

const app = express();

app.use(express.json());

app.use(async (req, res, next) => {
  try {
    const config = await getGatewayConfig();
    const secret = config.secret || '';

    if (!secret) return next();

    const auth = req.headers['authorization'] || '';
    if (auth !== `Bearer ${secret}`) {
      logger.warn('Requisição não autorizada.', { ip: req.ip, path: req.path });
      return res.status(401).json({ success: false, error: 'Não autorizado.' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { body: req.body });
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'gpswox-gateway',
    timestamp: new Date().toISOString(),
  });
});

app.post('/localizacao', async (req, res) => {
  const { veiculo, device_id: deviceId } = req.body;

  if (!veiculo && !deviceId) {
    return res.status(400).json({
      success: false,
      error: 'Informe "veiculo" ou "device_id".',
    });
  }

  try {
    const resultado = await getLocation({ veiculo, deviceId });
    return res.json(resultado);
  } catch (err) {
    logger.error('Erro ao buscar localização.', { veiculo, deviceId, err: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/clientes', async (req, res) => {
  try {
    const resultado = await createCliente(req.body);
    return res.json({ success: true, data: resultado });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/veiculos', async (req, res) => {
  try {
    const resultado = await createVeiculo(req.body);
    return res.json({ success: true, data: resultado });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/comandos', async (req, res) => {
  const { device_id: deviceId, comando } = req.body;
  if (!deviceId || !comando) {
    return res.status(400).json({ success: false, error: 'device_id e comando são obrigatórios.' });
  }

  try {
    const resultado = await sendCommand(deviceId, comando);
    return res.json({ success: true, data: resultado });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/bloqueio', async (req, res) => {
  const { device_id: deviceId } = req.body;
  if (!deviceId) {
    return res.status(400).json({ success: false, error: 'device_id é obrigatório.' });
  }

  try {
    const resultado = await blockDevice(deviceId);
    return res.json({ success: true, data: resultado });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/desbloqueio', async (req, res) => {
  const { device_id: deviceId } = req.body;
  if (!deviceId) {
    return res.status(400).json({ success: false, error: 'device_id é obrigatório.' });
  }

  try {
    const resultado = await unblockDevice(deviceId);
    return res.json({ success: true, data: resultado });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/historico', async (req, res) => {
  const { device_id: deviceId, from, to } = req.body;
  if (!deviceId || !from || !to) {
    return res.status(400).json({
      success: false,
      error: 'device_id, from e to são obrigatórios.',
    });
  }

  try {
    const resultado = await getHistory(deviceId, from, to);
    return res.json({ success: true, data: resultado });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/compartilhar', async (req, res) => {
  const { device_id: deviceId, duration_minutes: durationMinutes } = req.body;
  if (!deviceId) {
    return res.status(400).json({ success: false, error: 'device_id é obrigatório.' });
  }

  try {
    const resultado = await createSharing(deviceId, { durationMinutes: durationMinutes || 60 });
    return res.json({ success: true, data: resultado });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/dispositivos', async (req, res) => {
  try {
    const resultado = await listDevices();
    return res.json({ success: true, data: resultado });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/alertas', (req, res) => {
  res.status(501).json({ success: false, error: 'Endpoint em desenvolvimento.' });
});

app.post('/cerca', (req, res) => {
  res.status(501).json({ success: false, error: 'Endpoint em desenvolvimento.' });
});

app.post('/eventos', (req, res) => {
  res.status(501).json({ success: false, error: 'Endpoint em desenvolvimento.' });
});

process.on('SIGTERM', async () => {
  logger.info('Encerrando gateway...');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Interrompido. Encerrando gateway...');
  await closeBrowser();
  process.exit(0);
});

async function bootstrap() {
  if (process.env.DATABASE_URL) {
    const store = getStore();
    await store.migrate();
    logger.info('Configurações de integração carregadas do banco.');
  } else {
    logger.warn('DATABASE_URL ausente — usando variáveis de ambiente como fallback.');
  }

  const gatewayConfig = await getGatewayConfig().catch(() => ({ port: 3001 }));
  const PORT = gatewayConfig.port || process.env.GATEWAY_PORT || 3001;

  app.listen(PORT, () => {
    logger.info(`Gateway GPSWOX rodando na porta ${PORT}`);
  });
}

bootstrap().catch(err => {
  logger.error('Falha ao iniciar gateway.', { err: err.message });
  process.exit(1);
});
