const { recordHttpRequest, normalizeRoute, isPrometheusEnabled } = require('../infrastructure/prometheus-metrics');

function metricsMiddleware(req, res, next) {
  if (!isPrometheusEnabled()) return next();

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    recordHttpRequest({
      method: req.method,
      route: normalizeRoute(req.path),
      status: res.statusCode,
      durationMs,
      tenantId: req.tenantId,
    });
  });

  return next();
}

module.exports = { metricsMiddleware };
