const { getRedis, isRedisEnabled } = require('./redis');

async function acquireLock(key, ttlSeconds = 30) {
  if (!isRedisEnabled()) return 'local';
  const redis = await getRedis();
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ok = await redis.set(`lock:${key}`, token, 'EX', ttlSeconds, 'NX');
  return ok === 'OK' ? token : null;
}

async function releaseLock(key, token) {
  if (!isRedisEnabled() || token === 'local') return;
  const redis = await getRedis();
  const current = await redis.get(`lock:${key}`);
  if (current === token) {
    await redis.del(`lock:${key}`);
  }
}

async function withLock(key, fn, ttlSeconds = 30) {
  const token = await acquireLock(key, ttlSeconds);
  if (!token) return { skipped: true, reason: 'lock_busy' };
  try {
    return await fn();
  } finally {
    await releaseLock(key, token);
  }
}

module.exports = { acquireLock, releaseLock, withLock };
