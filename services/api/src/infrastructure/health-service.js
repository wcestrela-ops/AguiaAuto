const os = require('os');
const { getPool } = require('../db/pool');
const { pingRedis, isRedisEnabled } = require('./redis');
const { getAllQueueStats } = require('./queues');
const { getProviderStatus } = require('./tracking-cache');

const startedAt = Date.now();

async function checkPostgres() {
  const start = Date.now();
  try {
    await getPool().query('SELECT 1');
    return { status: 'HEALTHY', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'UNAVAILABLE', latencyMs: Date.now() - start, error: err.message };
  }
}

async function checkRedis() {
  if (!isRedisEnabled()) {
    return { status: 'DEGRADED', latencyMs: 0, error: 'REDIS_URL not configured' };
  }
  const start = Date.now();
  const result = await pingRedis();
  const healthy = result.status === 'ok' || result === true;
  return {
    status: healthy ? 'HEALTHY' : 'UNAVAILABLE',
    latencyMs: result.latency_ms ?? (Date.now() - start),
    enabled: result.enabled !== false,
  };
}

async function checkGateway(name, baseUrl) {
  if (!baseUrl) {
    return { status: 'DEGRADED', latencyMs: 0, error: `${name} URL not configured` };
  }
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { status: 'DEGRADED', latencyMs, httpStatus: res.status };
    }
    const body = await res.json().catch(() => ({}));
    return {
      status: body.status === 'ok' || body.ok ? 'HEALTHY' : 'DEGRADED',
      latencyMs,
      details: body,
    };
  } catch (err) {
    return { status: 'UNAVAILABLE', latencyMs: Date.now() - start, error: err.message };
  }
}

function aggregateStatus(components) {
  const values = Object.values(components).map((c) => c.status);
  if (values.every((s) => s === 'HEALTHY')) return 'HEALTHY';
  if (values.some((s) => s === 'UNAVAILABLE')) {
    const unhealthyCore = ['postgres', 'api'].some((k) => components[k]?.status === 'UNAVAILABLE');
    return unhealthyCore ? 'UNAVAILABLE' : 'DEGRADED';
  }
  if (values.some((s) => s === 'RECOVERING')) return 'RECOVERING';
  return 'DEGRADED';
}

async function getHealthReport() {
  const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:3001';
  const [postgres, redis, gpswoxGateway, traccarGateway, queues] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkGateway('gpswox', gatewayUrl),
    checkGateway('traccar', `${gatewayUrl}/traccar`),
    getAllQueueStats().catch(() => ({})),
  ]);

  const [providerStatus, traccarStatus] = await Promise.all([
    getProviderStatus('gpswox').catch(() => null),
    getProviderStatus('traccar').catch(() => null),
  ]);

  const components = {
    api: { status: 'HEALTHY', latencyMs: 0 },
    postgres,
    redis,
    gpswoxGateway: {
      ...gpswoxGateway,
      lastSync: providerStatus?.lastSync || providerStatus?.updated_at || null,
    },
    traccarGateway: {
      ...traccarGateway,
      lastSync: traccarStatus?.lastSync || traccarStatus?.updated_at || null,
    },
  };

  return {
    status: aggregateStatus(components),
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    hostname: os.hostname(),
    components,
    queues,
    monitoring: {
      sentry: Boolean(process.env.SENTRY_DSN),
      uptimeKuma: Boolean(process.env.UPTIME_KUMA_PUSH_URL),
      prometheus: process.env.PROMETHEUS_ENABLED === 'true',
    },
  };
}

module.exports = {
  getHealthReport,
  aggregateStatus,
};
