require('dotenv').config();

const logger = require('./logger');
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
const { migratePhase4SaasBilling } = require('./db/migrate-phase4-saas-billing');
const { migratePhase6TrackingProvider } = require('./db/migrate-phase6-tracking-provider');
const { migratePhase7TenantIntegrations } = require('./db/migrate-phase7-tenant-integrations');
const { migratePhase11TenantBranding } = require('./db/migrate-phase11-tenant-branding');
const { migratePhase14CustomDomain } = require('./db/migrate-phase14-custom-domain');
const { migratePhase15CrmLeads } = require('./db/migrate-phase15-crm-leads');
const { migrateCommandStates } = require('./db/migrate-command-states');
const { initSentry } = require('./infrastructure/sentry');
const { attachWebSocket } = require('./infrastructure/websocket');
const { isRedisEnabled } = require('./infrastructure/redis');
const { getRbacRepository } = require('./repositories/rbac-repository');
const { getAdminAuthService } = require('./services/admin-auth-service');
const http = require('http');
const { createApp } = require('./create-app');

const PROCESS_ROLE = process.env.PROCESS_ROLE || 'api';
const PORT = process.env.API_PORT || process.env.PORT || 3000;

async function bootstrap() {
  initSentry();

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

    const saasBillingSeed = await migratePhase4SaasBilling();
    logger.info(`Fase 4 — billing SaaS: plano ${saasBillingSeed.plan_id}, ${saasBillingSeed.modules_linked} módulos vinculados.`);

    const trackingSeed = await migratePhase6TrackingProvider();
    logger.info(`Fase 6 — TrackingProvider: ${trackingSeed.vehicles} veículos, ${trackingSeed.gpswox_users} users GPSWOX mapeados.`);

    const integrationsSeed = await migratePhase7TenantIntegrations();
    logger.info(`Fase 7 — integrações tenant: modos ${integrationsSeed.credential_modes.join('/')}, ${integrationsSeed.tenants_seeded} tenants seed.`);

    await migratePhase11TenantBranding();
    logger.info('Fase 11 — branding por tenant (nome, logo, cor, domínio) inicializado.');

    await migratePhase14CustomDomain();
    logger.info('Fase 14 — índice domínio custom white-label aplicado.');

    await migratePhase15CrmLeads();
    logger.info('Fase 15 — CRM/leads multi-tenant inicializado.');

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

  const app = createApp();
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

if (require.main === module) {
  bootstrap().catch((err) => {
    logger.error('Falha ao iniciar API.', { err: err.message });
    process.exit(1);
  });
}

module.exports = { createApp, bootstrap };
