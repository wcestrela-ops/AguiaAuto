const express = require('express');
const logger = require('./logger');
const cors = require('./middleware/cors');
const adminAuth = require('./middleware/admin-auth');
const { jwtAuth, requireRole } = require('./middleware/jwt-auth');
const { requireServiceContract } = require('./middleware/require-service-contract');
const { getHealthReport, getReadinessReport } = require('./infrastructure/health-service');
const { formatMetrics, isPrometheusEnabled } = require('./infrastructure/prometheus-metrics');
const { metricsMiddleware } = require('./middleware/metrics-middleware');
const { requestIdMiddleware } = require('./middleware/request-id');
const { securityHeaders } = require('./middleware/security-headers');
const { errorHandler } = require('./middleware/error-handler');
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
const adminBrandingRoutes = require('./modules/admin/branding/routes');
const adminSaasAccountRoutes = require('./modules/admin/saas-account/routes');
const adminExportRoutes = require('./modules/admin/export/routes');
const platformRoutes = require('./modules/platform/routes');
const tenantRoutes = require('./modules/tenant/routes');
const clientModulesRoutes = require('./modules/client/modules/routes');
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
const openapiRoutes = require('./modules/openapi/routes');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(requestIdMiddleware);
  app.use(securityHeaders);
  app.use(cookieParser());
  app.use(cors);
  app.use(defaultTenantContext);
  app.use(metricsMiddleware);
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

  app.get('/health/live', (req, res) => {
    res.status(200).json({
      status: 'HEALTHY',
      service: 'aguia-api',
      probe: 'live',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (req, res) => {
    try {
      const report = await getReadinessReport();
      const httpStatus = report.status === 'UNAVAILABLE' ? 503 : 200;
      res.status(httpStatus).json({
        service: 'aguia-api',
        probe: 'ready',
        ...report,
      });
    } catch (err) {
      res.status(503).json({
        status: 'UNAVAILABLE',
        service: 'aguia-api',
        probe: 'ready',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/metrics', (req, res) => {
    if (!isPrometheusEnabled()) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Métricas desabilitadas. Defina PROMETHEUS_ENABLED=true.', requestId: req.requestId },
      });
    }
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(formatMetrics());
  });

  app.use('/v1', openapiRoutes);
  app.use('/v1/plans', plansRoutes);
  app.use('/v1/site', siteRoutes);
  app.use('/v1/tenant', tenantRoutes);
  app.use('/v1/indicacoes', indicacoesPublicRoutes);

  app.use(csrfProtection);
  app.use('/v1', (req, res, next) => requireModule()(req, res, next));

  app.use('/v1/lgpd', jwtAuth, tenantContext, lgpdRoutes);
  app.use('/v1/auth', authRoutes);
  app.use('/v1/config', configRoutes);
  app.use('/webhooks', webhooksRoutes);
  app.use('/v1/sms/gateway', gpswoxGatewayRoutes);
  app.use('/v1/onboarding', onboardingRoutes);

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
  app.use('/v1/client/modules', jwtAuth, tenantContext, clientModulesRoutes);
  app.use('/v1/instalador', jwtAuth, tenantContext, requireRole('installer', 'admin'), instaladorRoutes);
  app.use('/v1/platform', platformRoutes);
  app.use('/v1/admin/auth', adminAuthRoutes);

  const adminProtected = [adminAuth, tenantContext, adminRbac];

  app.use('/v1/admin/security', adminSecurityRoutes);
  app.use('/v1/admin/lgpd', adminLgpdRoutes);
  app.use('/v1/admin/modules', ...adminProtected, adminModulesRoutes);
  app.use('/v1/admin/branding', ...adminProtected, adminBrandingRoutes);
  app.use('/v1/admin', ...adminProtected, adminSaasAccountRoutes);
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

  return app;
}

module.exports = { createApp };
