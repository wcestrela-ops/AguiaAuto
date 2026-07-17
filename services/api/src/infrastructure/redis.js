const Redis = require('ioredis');
const logger = require('../logger');

let client = null;
let subscriber = null;

function isRedisEnabled() {
  return Boolean(process.env.REDIS_URL);
}

function createClient(label = 'main') {
  const instance = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
    connectionName: `aguia-api-${label}`,
  });

  instance.on('error', (err) => {
    logger.warn('Redis connection error.', { label, err: err.message });
  });

  return instance;
}

async function getRedis() {
  if (!isRedisEnabled()) return null;
  if (!client) {
    client = createClient('main');
    await client.connect();
  }
  return client;
}

async function getRedisSubscriber() {
  if (!isRedisEnabled()) return null;
  if (!subscriber) {
    subscriber = createClient('subscriber');
    await subscriber.connect();
  }
  return subscriber;
}

async function pingRedis() {
  if (!isRedisEnabled()) {
    return { enabled: false, status: 'disabled', latency_ms: null };
  }

  const started = Date.now();
  try {
    const redis = await getRedis();
    const pong = await redis.ping();
    return {
      enabled: true,
      status: pong === 'PONG' ? 'ok' : 'degraded',
      latency_ms: Date.now() - started,
    };
  } catch (err) {
    return {
      enabled: true,
      status: 'error',
      latency_ms: Date.now() - started,
      error: err.message,
    };
  }
}

async function closeRedis() {
  const closers = [];
  if (client) closers.push(client.quit().catch(() => client.disconnect()));
  if (subscriber) closers.push(subscriber.quit().catch(() => subscriber.disconnect()));
  client = null;
  subscriber = null;
  await Promise.all(closers);
}

module.exports = {
  isRedisEnabled,
  getRedis,
  getRedisSubscriber,
  pingRedis,
  closeRedis,
};
