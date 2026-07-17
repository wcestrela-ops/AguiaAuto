let sentry = null;
let enabled = false;

function isSentryEnabled() {
  return enabled && Boolean(process.env.SENTRY_DSN);
}

function initSentry() {
  if (!process.env.SENTRY_DSN) return null;

  try {
    // eslint-disable-next-line global-require
    sentry = require('@sentry/node');
    sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || 'aguia-api@0.1.0',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      beforeSend(event) {
        if (event.request?.headers?.authorization) {
          delete event.request.headers.authorization;
        }
        if (event.request?.headers?.cookie) {
          delete event.request.headers.cookie;
        }
        return event;
      },
    });
    enabled = true;
    return sentry;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[sentry] Falha ao inicializar:', err.message);
    return null;
  }
}

function captureException(err, context = {}) {
  if (!isSentryEnabled()) return;
  sentry.withScope((scope) => {
    if (context.requestId) scope.setTag('request_id', context.requestId);
    if (context.path) scope.setTag('path', context.path);
    if (context.tenantId) scope.setTag('tenant_id', String(context.tenantId));
    sentry.captureException(err);
  });
}

function sentryErrorHandler() {
  if (!isSentryEnabled()) {
    return (_err, _req, _res, next) => next();
  }
  return sentry.Handlers.errorHandler();
}

module.exports = {
  initSentry,
  isSentryEnabled,
  captureException,
  sentryErrorHandler,
};
