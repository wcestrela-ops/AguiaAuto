require('dotenv').config();

const express = require('express');
const logger = require('./logger');
const cors = require('./middleware/cors');
const adminAuth = require('./middleware/admin-auth');
const { getStore } = require('@aguia/integrations');
const { getRepository } = require('@aguia/whatsapp');

const dashboardRoutes = require('./modules/dashboard/routes');
const veiculosRoutes = require('./modules/veiculos/routes');
const financeiroRoutes = require('./modules/financeiro/routes');
const alertasRoutes = require('./modules/alertas/routes');
const emergenciaRoutes = require('./modules/emergencia/routes');
const perfilRoutes = require('./modules/perfil/routes');
const indicacoesRoutes = require('./modules/indicacoes/routes');
const instaladorRoutes = require('./modules/instalador/routes');
const webhooksRoutes = require('./modules/webhooks/routes');
const onboardingRoutes = require('./modules/onboarding/routes');
const adminIntegracoesRoutes = require('./modules/admin/integracoes/routes');
const adminWhatsappRoutes = require('./modules/admin/whatsapp/routes');
const configRoutes = require('./modules/config/routes');

const app = express();
const PORT = process.env.API_PORT || process.env.PORT || 3000;

app.use(cors);
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'aguia-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/v1/dashboard', dashboardRoutes);
app.use('/v1/veiculos', veiculosRoutes);
app.use('/v1/financeiro', financeiroRoutes);
app.use('/v1/alertas', alertasRoutes);
app.use('/v1/emergencia', emergenciaRoutes);
app.use('/v1/perfil', perfilRoutes);
app.use('/v1/indicacoes', indicacoesRoutes);
app.use('/v1/instalador', instaladorRoutes);
app.use('/v1/onboarding', onboardingRoutes);
app.use('/v1/config', configRoutes);
app.use('/webhooks', webhooksRoutes);

app.use('/v1/admin/integracoes', adminAuth, adminIntegracoesRoutes);
app.use('/v1/admin/whatsapp', adminAuth, adminWhatsappRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Rota não encontrada.' });
});

async function bootstrap() {
  if (process.env.DATABASE_URL) {
    const store = getStore();
    await store.migrate();
    logger.info('Banco de integrações inicializado.');

    const whatsappRepo = getRepository();
    await whatsappRepo.migrate();
    logger.info('Módulo WhatsApp multi-provedor inicializado.');
  } else {
    logger.warn('DATABASE_URL ausente — integrações usarão apenas variáveis de ambiente.');
  }

  app.listen(PORT, () => {
    logger.info(`API Águia Gestão Veicular rodando na porta ${PORT}`);
    logger.info('WhatsApp: PUT /v1/admin/whatsapp/:id (Configurações → Integrações → WhatsApp)');
  });
}

bootstrap().catch(err => {
  logger.error('Falha ao iniciar API.', { err: err.message });
  process.exit(1);
});
