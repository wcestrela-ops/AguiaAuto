const buckets = new Map();
const { checkRateLimit } = require('../infrastructure/redis-rate-limit');
const { isRedisEnabled } = require('../infrastructure/redis');

function pruneBuckets() {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

setInterval(pruneBuckets, 60_000).unref();

function memoryRateLimit(key, { windowMs = 60_000, max = 10 } = {}) {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= max,
    remaining: Math.max(0, max - bucket.count),
  };
}

function createRateLimiter({ windowMs = 60_000, max = 10, keyFn = (req) => req.ip || 'unknown' }) {
  return async (req, res, next) => {
    const key = keyFn(req);

    let result;
    if (isRedisEnabled()) {
      try {
        result = await checkRateLimit(key, { windowMs, max });
      } catch {
        result = memoryRateLimit(key, { windowMs, max });
      }
    } else {
      result = memoryRateLimit(key, { windowMs, max });
    }

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Muitas requisições. Tente novamente em instantes.',
      });
    }

    return next();
  };
}

const authLoginLimiter = createRateLimiter({
  windowMs: 60_000,
  max: parseInt(process.env.RATE_LIMIT_AUTH_LOGIN || '10', 10),
  keyFn: (req) => `login:${req.ip}:${req.body?.email || ''}`,
});

const vehicleCommandLimiter = createRateLimiter({
  windowMs: 60_000,
  max: parseInt(process.env.RATE_LIMIT_VEHICLE_COMMANDS || '8', 10),
  keyFn: (req) => `cmd:${req.user?.id || req.ip}:${req.params?.id || ''}`,
});

const emergencyTriggerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_EMERGENCY || '6', 10),
  keyFn: (req) => `emergency:${req.user?.id || req.ip}`,
});

module.exports = {
  createRateLimiter,
  authLoginLimiter,
  vehicleCommandLimiter,
  emergencyTriggerLimiter,
};
