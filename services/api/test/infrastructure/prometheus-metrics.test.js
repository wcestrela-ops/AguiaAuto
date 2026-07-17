const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRoute,
  incCounter,
  observeHistogram,
  formatMetrics,
  recordHttpRequest,
  resetMetricsForTests,
  isPrometheusEnabled,
} = require('../../src/infrastructure/prometheus-metrics');

test('normalizeRoute reduz cardinalidade de IDs', () => {
  assert.equal(normalizeRoute('/v1/platform/tenants/42'), '/v1/platform/tenants/:id');
  assert.equal(normalizeRoute('/v1/admin/veiculos/999/comandos'), '/v1/admin/veiculos/:id');
  assert.equal(normalizeRoute('/health/live'), '/health/live');
});

test('formatMetrics exporta texto Prometheus', () => {
  resetMetricsForTests();
  incCounter('aguia_http_requests_total', { method: 'GET', route: '/health/live', status: '200', tenant_id: '1' });
  observeHistogram('aguia_http_request_duration_seconds', { method: 'GET', route: '/health/live', tenant_id: '1' }, 0.02);

  const text = formatMetrics();
  assert.match(text, /aguia_process_uptime_seconds/);
  assert.match(text, /aguia_http_requests_total/);
  assert.match(text, /aguia_http_request_duration_seconds_bucket/);
  assert.match(text, /le="\+Inf"/);
});

test('recordHttpRequest incrementa contadores', () => {
  resetMetricsForTests();
  recordHttpRequest({ method: 'GET', route: '/v1/plans', status: 200, durationMs: 12, tenantId: 1 });
  const text = formatMetrics();
  assert.match(text, /route="\/v1\/plans"/);
  assert.match(text, /tenant_id="1"/);
});

test('isPrometheusEnabled respeita env', () => {
  const prev = process.env.PROMETHEUS_ENABLED;
  process.env.PROMETHEUS_ENABLED = 'true';
  assert.equal(isPrometheusEnabled(), true);
  process.env.PROMETHEUS_ENABLED = 'false';
  assert.equal(isPrometheusEnabled(), false);
  if (prev === undefined) delete process.env.PROMETHEUS_ENABLED;
  else process.env.PROMETHEUS_ENABLED = prev;
});
