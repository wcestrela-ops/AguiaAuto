const { getRedis, isRedisEnabled } = require('./redis');

async function checkRateLimit(key, { windowMs = 60_000, max = 10 } = {}) {
  if (!isRedisEnabled()) return { allowed: true, remaining: max, source: 'memory' };

  const redis = await getRedis();
  const bucketKey = `ratelimit:${key}`;
  const count = await redis.incr(bucketKey);
  if (count === 1) {
    await redis.pexpire(bucketKey, windowMs);
  }

  const ttl = await redis.pttl(bucketKey);
  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    resetMs: ttl > 0 ? ttl : windowMs,
    source: 'redis',
  };
}

module.exports = { checkRateLimit };
