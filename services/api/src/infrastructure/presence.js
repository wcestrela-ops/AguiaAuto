const { getRedis, isRedisEnabled } = require('./redis');

const VIEWER_TTL_SECONDS = 120;

async function touchVehicleViewer(vehicleId, viewerId) {
  if (!isRedisEnabled()) return;
  const redis = await getRedis();
  const key = `tracking:viewers:${vehicleId}`;
  await redis.zadd(key, Date.now(), String(viewerId));
  await redis.expire(key, VIEWER_TTL_SECONDS);
  await redis.zremrangebyscore(key, 0, Date.now() - VIEWER_TTL_SECONDS * 1000);
}

async function removeVehicleViewer(vehicleId, viewerId) {
  if (!isRedisEnabled()) return;
  const redis = await getRedis();
  await redis.zrem(`tracking:viewers:${vehicleId}`, String(viewerId));
}

async function trackVehicleViewer(vehicleId, userId) {
  return touchVehicleViewer(vehicleId, userId);
}

async function countVehicleViewers(vehicleId) {
  if (!isRedisEnabled()) return 0;
  const redis = await getRedis();
  const key = `tracking:viewers:${vehicleId}`;
  await redis.zremrangebyscore(key, 0, Date.now() - VIEWER_TTL_SECONDS * 1000);
  return redis.zcard(key);
}

function resolvePollIntervalMs({ viewers = 0, online = null } = {}) {
  if (viewers > 0) {
    return parseInt(process.env.TRACKING_POLL_LIVE_MS || '8000', 10);
  }
  if (online === true) {
    return parseInt(process.env.TRACKING_POLL_ONLINE_MS || '45000', 10);
  }
  return parseInt(process.env.TRACKING_POLL_OFFLINE_MS || '180000', 10);
}

module.exports = {
  touchVehicleViewer,
  removeVehicleViewer,
  trackVehicleViewer,
  countVehicleViewers,
  resolvePollIntervalMs,
};
