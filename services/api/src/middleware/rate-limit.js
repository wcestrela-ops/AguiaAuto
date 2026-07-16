const buckets = new Map();

function pruneBuckets() {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

setInterval(pruneBuckets, 60_000).unref();

function createRateLimiter({ windowMs = 60_000, max = 10, keyFn = (req) => req.ip || 'unknown' }) {
  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
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

module.exports = {
  createRateLimiter,
  authLoginLimiter,
  vehicleCommandLimiter,
};
