require('dotenv').config();

const express = require('express');
const logger = require('./logger');
const cors = require('./middleware/cors');
const adminAuth = require('./middleware/admin-auth');
const { jwtAuth, requireRole } = require('./middleware/jwt-auth');
const { requireServiceContract } = require('./middleware/require-service-contract');
const { getStore } = require('@aguia/integrations');
const { getRepository } = require('@aguia/whatsapp');
const { migrateUsers } = require('./db/migrate-users');
const { migrateUserAccess } = require('./db/migrate-user-access');
const { migrateFcmTokens } = require('./db/migrate-fcm');
const { migratePasswordReset } = require('./db/migrate-password-reset');
const { migrateVehicles } = require('./db/migrate-vehicles');
const { migrateFinanceiro } = require('./db/migrate-financeiro');
const { migratePaymentGateways } = require('./db/migrate-payment-gateways');
const { migrateAlerts } = require('./db/migrate-alerts');
const { migrateInstalador } = require('./db/migrate-instalador');
const { migrateContratos } = require('./db/migrate-contratos');
const { migrateContratosSnapshot } = require('./db/migrate-contratos-snapshot');
const { migrateAncora } = require('./db/migrate-ancora');
const { migrateIndicacoes } = require('./db/migrate-indicacoes');
const { migrateVehicleSms } = require('./db/migrate-vehicle-sms');
const { migrateAdminAudit } = require('./db/migrate-admin-audit');
const { migrateTrackerLibrary } = require('./db/migrate-tracker-library');
const { migrateTrackerGpswoxSms } = require('./db/migrate-tracker-gpswox-sms');
    const { migrateGpswoxSyncRuns } = require('./db/migrate-gpswox-sync-runs');
    const { migrateAsaasSyncRuns } = require('./db/migrate-asaas-sync-runs');
const { migrateTrackerPlatformColumns } = require('./db/migrate-tracker-platform-columns');
const { migrateVehiclePerPlatform } = require('./db/migrate-vehicle-per-platform');
const { migrateBillingNotifications } = require('./db/migrate-billing-notifications');
const { migrateBillingAutomation } = require('./db/migrate-billing-automation');
const { migrateVehicleFleet } = require('./db/migrate-vehicle-fleet');
const { migrateFleetReminders } = require('./db/migrate-fleet-reminders');
const { migrateEmergencia } = require('./db/migrate-emergencia');
const { migrateVehicleTracker } = require('./db/migrate-vehicle-tracker');
const { migrateVehiclePlateOptional } = require('./db/migrate-vehicle-plate-optional');
const { migrateVehicleInstallerAssignment } = require('./db/migrate-vehicle-installer-assignment');
const { migrateFleetReminderChannels } = require('./db/migrate-fleet-reminder-channels');
const { migrateSiteContent } = require('./db/migrate-site-content');
const { getRepository: getSmsRepository } = require('@aguia/sms');
const { migrateSecurityPhase3 } = require('./db/migrate-security-phase3');
const { migrateTenantsFoundation } = require('./db/migrate-tenants-foundation');
const { migrateAguiaTenantSeed } = require('./db/migrate-aguia-tenant-seed');
const { migratePhase2TenantTables } = require('./db/migrate-phase2-tenant-tables');
const { migratePhase3Modules } = require('./db/migrate-phase3-modules');
const { migrateCommandStates } = require('./db/migrate-command-states');
const { getHealthReport } = require('./infrastructure/health-service');
const { attachWebSocket } = require('./infrastructure/websocket');
const { isRedisEnabled } = require('./infrastructure/redis');
const { getRbacRepository } = require('./repositories/rbac-repository');
const { getAdminAuthService } = require('./services/admin-auth-service');
const { requestIdMiddleware } = require('./middleware/request-id');
const { securityHeaders } = require('./middleware/security-headers');
const { errorHandler } = require('./middleware/error-handler');
const http = require('http');

const PROCESS_ROLE = process.env.PROCESS_ROLE || 'api';

const authRoutes = require('./modules/auth/routes');
const dashboardRoutes = require('./modules/dashboard/routes');
const veiculosRoutes = require('./modules/veiculos/routes');
const financeiroRoutes = require('./modules/financeiro/routes');
const alertasRoutes = require('./modules/alertas/routes');
const emergenciaRoutes = require('./modules/emergencia/routes');
const perfilRoutes = require('./modules/perfil/routes');
const notificacoesRoutes = require('./modules/notificacoes/routes');
const indicacoesRoutes = require('./modules/indicacoes/routes');
const indicacoesPublicRoutes = require('./modules/indicacoes/public-routes');
const frotaRoutes = require('./modules/frota/routes');
const contratosRoutes = require('./modules/contratos/routes');
const instaladorRoutes = require('./modules/instalador/routes');
const webhooksRoutes = require('./modules/webhooks/routes');
const onboardingRoutes = require('./modules/onboarding/routes');
const adminIntegracoesRoutes = require('./modules/admin/integracoes/routes');
const adminWhatsappRoutes = require('./modules/admin/whatsapp/routes');
const adminVeiculosRoutes = require('./modules/admin/veiculos/routes');
const adminUsuariosRoutes = require('./modules/admin/usuarios/routes');
const adminFinanceiroRoutes = require('./modules/admin/financeiro/routes');
const adminPlansRoutes = require('./modules/admin/plans/routes');
const adminAlertasRoutes = require('./modules/admin/alertas/routes');
const adminComunicacaoRoutes = require('./modules/admin/comunicacao/routes');
const adminInstaladoresRoutes = require('./modules/admin/instaladores/routes');
const adminContratosRoutes = require('./modules/admin/contratos/routes');
const adminAuditRoutes = require('./modules/admin/audit/routes');
const adminFrotaRoutes = require('./modules/admin/frota/routes');
const adminIndicacoesRoutes = require('./modules/admin/indicacoes/routes');
const adminEmergenciaRoutes = require('./modules/admin/emergencia/routes');
const adminSiteRoutes = require('./modules/admin/site/routes');
const adminSmsRoutes = require('./modules/admin/sms/routes');
const adminSmsModelsRoutes = require('./modules/admin/sms/models-routes');
const adminAuthRoutes = require('./modules/admin/auth/routes');
const adminSecurityRoutes = require('./modules/admin/security/routes');
const adminLgpdRoutes = require('./modules/admin/lgpd/routes');
const adminModulesRoutes = require('./modules/admin/modules/routes');
const platformRoutes = require('./modules/platform/routes');
const lgpdRoutes = require('./modules/lgpd/routes');
const { requireModule } = require('./middleware/require-module');
const { adminRbac } = require('./lib/security/admin-route-permissions');
const { csrfProtection } = require('./middleware/csrf');
const { defaultTenantContext, tenantContext } = require('./middleware/tenant-context');
const { tenantGuardHandler } = require('./lib/tenant/tenant-guard');
const cookieParser = require('cookie-parser');
const adminDashboardRoutes = require('./modules/admin/dashboard/routes');
const adminSmsGpswoxTemplatesRoutes = require('./modules/admin/sms/gpswox-templates-routes');
const gpswoxGatewayRoutes = require('./modules/sms/gpswox-gateway-routes');
const plansRoutes = require('./modules/plans/routes');
const siteRoutes = require('./modules/site/routes');
const configRoutes = require('./modules/config/routes');

const app = express();
const PORT = process.env.API_PORT || process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(requestIdMiddleware);
app.use(securityHeaders);
app.use(cookieParser());
app.use(cors);
app.use(defaultTenantContext);
app.use(express.json({
  limit: process.env.API_JSON_LIMIT || '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.get('/health', async (req, res) => {
  try {
    const report = await getHealthReport();
    const httpStatus = report.status === 'UNAVAILABLE' ? 503 : 200;
    res.status(httpStatus).json({
      status: report.status,
      service: 'aguia-api',
      version: '0.1.0',
      ...report,
    });
  } catch (err) {
    res.status(503).json({
      status: 'UNAVAILABLE',
      service: 'aguia-api',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Planos públicos (cadastro) e landing page
app.use('/v1/plans', plansRoutes);
app.use('/v1/site', siteRoutes);

// Indicações — validação pública do código (cadastro)
app.use('/v1/indicacoes', indicacoesPublicRoutes);

app.use(csrfProtection);

// Verificação de módulos contratados (no-op quando MULTI_TENANT_ENABLED=false)
app.use('/v1', (req, res, next) => requireModule()(req, res, next));

// LGPD cliente autenticado
app.use('/v1/lgpd', jwtAuth, tenantContext, lgpdRoutes);

// Auth público
app.use('/v1/auth', authRoutes);

// Config pública (Firebase web config)
app.use('/v1/config', configRoutes);
app.use('/webhooks', webhooksRoutes);

// Gateway SMS GPSWOX (entrada HTTP — padrão %NUMBER% / %MESSAGE%)
app.use('/v1/sms/gateway', gpswoxGatewayRoutes);

// Onboarding (parcialmente público durante cadastro)
app.use('/v1/onboarding', onboardingRoutes);

// Rotas do cliente — requer JWT (+ contrato de serviço aceito, exceto /contratos)
app.use('/v1/dashboard', jwtAuth, tenantContext, requireServiceContract, dashboardRoutes);
app.use('/v1/veiculos', jwtAuth, tenantContext, requireServiceContract, veiculosRoutes);
app.use('/v1/financeiro', jwtAuth, tenantContext, requireServiceContract, financeiroRoutes);
app.use('/v1/alertas', jwtAuth, tenantContext, requireServiceContract, alertasRoutes);
app.use('/v1/emergencia', jwtAuth, tenantContext, requireServiceContract, emergenciaRoutes);
app.use('/v1/perfil', jwtAuth, tenantContext, requireServiceContract, perfilRoutes);
app.use('/v1/notificacoes', jwtAuth, tenantContext, requireServiceContract, notificacoesRoutes);
app.use('/v1/indicacoes', jwtAuth, tenantContext, requireServiceContract, indicacoesRoutes);
app.use('/v1/frota', jwtAuth, tenantContext, requireServiceContract, frotaRoutes);
app.use('/v1/contratos', jwtAuth, tenantContext, contratosRoutes);

// Área do instalador — JWT + role
app.use('/v1/instalador', jwtAuth, tenantContext, requireRole('installer', 'admin'), instaladorRoutes);

// Painel master da plataforma
app.use('/v1/platform', platformRoutes);

// Auth admin (público: login/refresh)
app.use('/v1/admin/auth', adminAuthRoutes);

// Painel admin — autenticação individual + tenant + RBAC
const adminProtected = [adminAuth, tenantContext, adminRbac];

app.use('/v1/admin/security', adminSecurityRoutes);
app.use('/v1/admin/lgpd', adminLgpdRoutes);
app.use('/v1/admin/modules', ...adminProtected, adminModulesRoutes);
app.use('/v1/admin/export', ...adminProtected, adminExportRoutes);
app.use('/v1/admin/integracoes', ...adminProtected, adminIntegracoesRoutes);
app.use('/v1/admin/whatsapp', ...adminProtected, adminWhatsappRoutes);
app.use('/v1/admin/sms/models', ...adminProtected, adminSmsModelsRoutes);
app.use('/v1/admin/sms/gpswox-templates', ...adminProtected, adminSmsGpswoxTemplatesRoutes);
app.use('/v1/admin/sms', ...adminProtected, adminSmsRoutes);
app.use('/v1/admin/veiculos', ...adminProtected, adminVeiculosRoutes);
app.use('/v1/admin/usuarios', ...adminProtected, adminUsuariosRoutes);
app.use('/v1/admin/financeiro', ...adminProtected, adminFinanceiroRoutes);
app.use('/v1/admin/plans', ...adminProtected, adminPlansRoutes);
app.use('/v1/admin/alertas', ...adminProtected, adminAlertasRoutes);
app.use('/v1/admin/comunicacao', ...adminProtected, adminComunicacaoRoutes);
app.use('/v1/admin/instaladores', ...adminProtected, adminInstaladoresRoutes);
app.use('/v1/admin/contratos', ...adminProtected, adminContratosRoutes);
app.use('/v1/admin/audit', ...adminProtected, adminAuditRoutes);
app.use('/v1/admin/frota', ...adminProtected, adminFrotaRoutes);
app.use('/v1/admin/indicacoes', ...adminProtected, adminIndicacoesRoutes);
app.use('/v1/admin/emergencia', ...adminProtected, adminEmergenciaRoutes);
app.use('/v1/admin/site', ...adminProtected, adminSiteRoutes);
app.use('/v1/admin/dashboard', ...adminProtected, adminDashboardRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Rota não encontrada.', requestId: req.requestId },
  });
});

app.use(tenantGuardHandler);
app.use(errorHandler);

async function bootstrap() {
  if (process.env.DATABASE_URL) {
    const store = getStore();
    await store.migrate();
    logger.info('Banco de integrações inicializado.');

    await migrateUsers();
    logger.info('Autenticação JWT (clientes) inicializada.');

    await migrateUserAccess();
    logger.info('Último acesso de clientes inicializado.');

    await migrateFcmTokens();
    logger.info('FCM tokens (push notifications) inicializado.');

    await migratePasswordReset();
    logger.info('Recuperação de senha inicializada.');

    await migrateVehicles();
    logger.info('Veículos e planos inicializados.');

    await migrateFinanceiro();
    logger.info('Financeiro (Asaas + faturas) inicializado.');

    await migratePaymentGateways();
    logger.info('Gateways de pagamento (Asaas + Mercado Pago) inicializados.');

    await migrateAlerts();
    logger.info('Motor de alertas (GPSWOX → push/WhatsApp) inicializado.');

    await migrateInstalador();
    logger.info('Área do instalador (installation_logs) inicializada.');

    await migrateContratos();
    logger.info('Contratos e termos de entrega inicializados.');

    await migrateContratosSnapshot();
    logger.info('Cópias assinadas de contratos (snapshot) inicializadas.');

    await migrateAncora();
    logger.info('Âncora veicular (monitoramento + bloqueio) inicializada.');

    await migrateIndicacoes();
    logger.info('Indique e Ganhe (indicações + desconto) inicializado.');

    await migrateVehicleSms();
    logger.info('Veículos — chip SMS e logs de comando inicializados.');

    await migrateCommandStates();
    logger.info('Estados de comando (máquina de estados) inicializados.');

    await migrateSecurityPhase3();
    logger.info('Segurança Fase 3 (RBAC, sessões, auditoria estendida) inicializada.');

    await migrateTenantsFoundation();
    logger.info('Fundação multi-tenant (tenant_id em tabelas core) inicializada.');

    const aguiaSeed = await migrateAguiaTenantSeed();
    logger.info(`Tenant Águia seed aplicado: ${JSON.stringify(aguiaSeed.counts)}`);

    await migratePhase2TenantTables();
    logger.info('Fase 2 — tenant_id em tabelas operacionais aplicado.');

    const moduleSeed = await migratePhase3Modules();
    logger.info(`Fase 3 — catálogo de módulos: ${moduleSeed.modules} módulos, tenant Águia ativado.`);

    await getRbacRepository().seedDefaults();
    logger.info('RBAC padrão (funções e permissões) inicializado.');

    await getAdminAuthService().bootstrapSuperAdmin();
    logger.info('Bootstrap de superadmin verificado.');

    const encryptionMigration = await getStore().migrateEncryptedSettings?.();
    if (encryptionMigration?.migrated) {
      logger.info(`Credenciais migradas para settings_encrypted: ${encryptionMigration.migrated}.`);
    }

    await migrateVehicleTracker();
    logger.info('Veículos — campos de rastreador/SMS (modelo, IMEI, sync GPSWOX) inicializados.');

    await migrateVehiclePlateOptional();
    logger.info('Veículos — placa opcional (veículos novos sem emplacamento) inicializado.');

    await migrateVehicleInstallerAssignment();
    logger.info('Veículos — atribuição de instalador inicializada.');

    await migrateFleetReminderChannels();
    logger.info('Lembretes de frota — canais WhatsApp/SMS inicializados.');

    await migrateSiteContent();
    logger.info('Conteúdo do site (landing page) inicializado.');

    await migrateTrackerLibrary();
    logger.info('Biblioteca de modelos e comandos SMS de rastreadores inicializada.');

    await migrateTrackerGpswoxSms();
    logger.info('Comandos SMS — vínculo gpswox_sms_template_id inicializado.');

    await migrateGpswoxSyncRuns();
    logger.info('Histórico de sync GPSWOX agendado inicializado.');

    await migrateAsaasSyncRuns();
    logger.info('Histórico de sync Asaas inicializado.');

    await migrateTrackerPlatformColumns();
    logger.info('Colunas tracker_* — migração concluída.');

    await migrateVehiclePerPlatform();
    logger.info('Plataforma por veículo — migração concluída.');

    await migrateBillingNotifications();
    logger.info('Notificações de cobrança (WhatsApp/SMS) inicializadas.');

    await migrateBillingAutomation();
    logger.info('Automação de lembretes e baixa manual inicializada.');

    await migrateVehicleFleet();
    logger.info('Documentos e manutenção de veículos inicializados.');

    await migrateFleetReminders();
    logger.info('Lembretes push de documentos e manutenção inicializados.');

    await migrateEmergencia();
    logger.info('Botão de emergência (SOS) inicializado.');

    await migrateAdminAudit();
    logger.info('Auditoria administrativa inicializada.');

    const whatsappRepo = getRepository();
    await whatsappRepo.migrate();
    logger.info('Módulo WhatsApp multi-provedor inicializado.');

    const smsRepo = getSmsRepository();
    await smsRepo.migrate();
    await smsRepo.ensureDefaultProvider();
    logger.info('Módulo SMS interno (gateways + dispatches) inicializado.');
  } else {
    logger.warn('DATABASE_URL ausente — integrações usarão apenas variáveis de ambiente.');
  }

  const server = http.createServer(app);

  if (PROCESS_ROLE === 'api') {
    attachWebSocket(server);
  }

  server.listen(PORT, () => {
    logger.info(`API Águia Gestão Veicular rodando na porta ${PORT} (role=${PROCESS_ROLE})`);
    logger.info('Auth cliente: POST /v1/auth/login | POST /v1/auth/register');

    const inlinePollers = process.env.ENABLE_INLINE_POLLERS === 'true'
      || (!isRedisEnabled() && PROCESS_ROLE === 'api');

    if (process.env.DATABASE_URL && inlinePollers) {
      const { startAnchorPoller } = require('./services/anchor-service');
      const { startReferralRewardPoller } = require('./services/referral-service');
      const { startGpswoxSyncPoller } = require('./services/gpswox-sync-service');
      const { startBillingReminderPoller } = require('./services/billing-reminder-service');
      const { startFleetReminderPoller } = require('./services/fleet-reminder-service');

      startAnchorPoller(parseInt(process.env.ANCORA_POLL_MS || '30000', 10));
      startReferralRewardPoller(parseInt(process.env.REFERRAL_POLL_MS || '60000', 10));
      startGpswoxSyncPoller(parseInt(process.env.GPSWOX_SYNC_CHECK_MS || '900000', 10));
      startBillingReminderPoller(
        parseInt(process.env.BILLING_REMINDER_CHECK_MS || '0', 10) || undefined,
      );
      startFleetReminderPoller(
        parseInt(process.env.FLEET_REMINDER_CHECK_MS || '0', 10) || undefined,
      );
      logger.info('Pollers inline iniciados (modo compatibilidade).');
    }
  });
}

bootstrap().catch(err => {
  logger.error('Falha ao iniciar API.', { err: err.message });
  process.exit(1);
});
