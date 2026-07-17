const os = require('os');

const startedAt = Date.now();

const counters = new Map();
const histogramBuckets = new Map();
const histogramSums = new Map();
const histogramCounts = new Map();

const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

function labelKey(labels) {
  return Object.keys(labels).sort().map((k) => `${k}="${escapeLabel(String(labels[k]))}"`).join(',');
}

function escapeLabel(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function incCounter(name, labels = {}, value = 1) {
  const key = `${name}{${labelKey(labels)}}`;
  counters.set(key, (counters.get(key) || 0) + value);
}

function observeHistogram(name, labels, valueSeconds) {
  const labelStr = labelKey(labels);
  for (const le of DURATION_BUCKETS) {
    if (valueSeconds <= le) {
      const bucketKey = `${name}_bucket{${labelStr},le="${le}"}`;
      histogramBuckets.set(bucketKey, (histogramBuckets.get(bucketKey) || 0) + 1);
    }
  }
  const infKey = `${name}_bucket{${labelStr},le="+Inf"}`;
  histogramBuckets.set(infKey, (histogramBuckets.get(infKey) || 0) + 1);

  const sumKey = `${name}_sum{${labelStr}}`;
  const countKey = `${name}_count{${labelStr}}`;
  histogramSums.set(sumKey, (histogramSums.get(sumKey) || 0) + valueSeconds);
  histogramCounts.set(countKey, (histogramCounts.get(countKey) || 0) + 1);
}

function normalizeRoute(path) {
  const clean = String(path || '/').split('?')[0];
  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 0) return '/';

  const normalized = parts.map((part) => {
    if (/^\d+$/.test(part)) return ':id';
    if (/^[0-9a-f-]{36}$/i.test(part)) return ':id';
    return part;
  });

  return `/${normalized.slice(0, 4).join('/')}`.replace(/\/$/, '') || '/';
}

function recordHttpRequest({ method, route, status, durationMs, tenantId }) {
  const baseLabels = {
    method: method.toUpperCase(),
    route,
    status: String(status),
    tenant_id: String(tenantId ?? '0'),
  };
  incCounter('aguia_http_requests_total', baseLabels);
  observeHistogram('aguia_http_request_duration_seconds', {
    method: baseLabels.method,
    route: baseLabels.route,
    tenant_id: baseLabels.tenant_id,
  }, durationMs / 1000);
}

function isPrometheusEnabled() {
  return process.env.PROMETHEUS_ENABLED === 'true';
}

function appendMap(lines, help, type, map) {
  if (map.size === 0) return;
  lines.push(`# HELP ${help}`);
  lines.push(`# TYPE ${type}`);
  for (const [key, value] of map) {
    lines.push(`${key} ${typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(6) : value}`);
  }
}

function formatMetrics() {
  const lines = [];
  const mem = process.memoryUsage();

  lines.push('# HELP aguia_process_uptime_seconds Tempo de execução do processo API');
  lines.push('# TYPE aguia_process_uptime_seconds gauge');
  lines.push(`aguia_process_uptime_seconds ${((Date.now() - startedAt) / 1000).toFixed(3)}`);

  lines.push('# HELP aguia_process_heap_bytes Heap memory em bytes');
  lines.push('# TYPE aguia_process_heap_bytes gauge');
  lines.push(`aguia_process_heap_bytes ${mem.heapUsed}`);

  lines.push('# HELP aguia_process_resident_bytes RSS em bytes');
  lines.push('# TYPE aguia_process_resident_bytes gauge');
  lines.push(`aguia_process_resident_bytes ${mem.rss}`);

  lines.push('# HELP aguia_nodejs_version_info Versão Node.js');
  lines.push('# TYPE aguia_nodejs_version_info gauge');
  lines.push(`aguia_nodejs_version_info{version="${process.version}",hostname="${escapeLabel(os.hostname())}"} 1`);

  appendMap(lines, 'aguia_http_requests_total Total de requisições HTTP', 'aguia_http_requests_total counter', counters);
  appendMap(lines, 'aguia_http_request_duration_seconds Duração das requisições HTTP', 'aguia_http_request_duration_seconds histogram', histogramBuckets);
  appendMap(lines, 'aguia_http_request_duration_seconds Duração das requisições HTTP', 'aguia_http_request_duration_seconds histogram', histogramSums);
  appendMap(lines, 'aguia_http_request_duration_seconds Duração das requisições HTTP', 'aguia_http_request_duration_seconds histogram', histogramCounts);

  return `${lines.join('\n')}\n`;
}

function resetMetricsForTests() {
  counters.clear();
  histogramBuckets.clear();
  histogramSums.clear();
  histogramCounts.clear();
}

module.exports = {
  recordHttpRequest,
  normalizeRoute,
  isPrometheusEnabled,
  formatMetrics,
  resetMetricsForTests,
  incCounter,
  observeHistogram,
};
