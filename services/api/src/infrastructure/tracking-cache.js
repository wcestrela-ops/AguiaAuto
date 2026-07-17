const { getRedis, isRedisEnabled } = require('./redis');
const { tenantCachePrefix } = require('../lib/tenant/tenant-query');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

const KEY_PREFIX = 'tracking:last-position:';
const DEFAULT_TTL_SECONDS = parseInt(process.env.TRACKING_CACHE_TTL_SECONDS || '86400', 10);

function cacheKey(vehicleId, tenantId = DEFAULT_TENANT_ID) {
  return `${tenantCachePrefix(tenantId)}${KEY_PREFIX}${vehicleId}`;
}

function normalizeLocation(location = {}, vehicle = {}) {
  const lat = parseFloat(location.latitude);
  const lng = parseFloat(location.longitude);
  return {
    vehicle_id: vehicle.id,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    speed: location.velocidade || location.speed || null,
    ignition: location.ignicao ?? location.ignition ?? null,
    online: location.online ?? null,
    provider: vehicle.tracking_provider || location.provider || 'gpswox',
    address: location.endereco || location.address || null,
    device_time: location.capturado_em || location.device_time || location.time || null,
    updated_at: new Date().toISOString(),
    raw: location,
  };
}

async function setLastPosition(vehicleId, location, vehicle = {}) {
  if (!isRedisEnabled()) return null;
  const redis = await getRedis();
  const tenantId = vehicle.tenant_id ?? DEFAULT_TENANT_ID;
  const payload = normalizeLocation(location, { ...vehicle, id: vehicleId });
  await redis.set(cacheKey(vehicleId, tenantId), JSON.stringify(payload), 'EX', DEFAULT_TTL_SECONDS);
  return payload;
}

async function getLastPosition(vehicleId, tenantId = DEFAULT_TENANT_ID) {
  if (!isRedisEnabled()) return null;
  const redis = await getRedis();
  const raw = await redis.get(cacheKey(vehicleId, tenantId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setProviderStatus(provider, status) {
  if (!isRedisEnabled()) return;
  const redis = await getRedis();
  await redis.set(
    `tracking:provider-status:${provider}`,
    JSON.stringify({ ...status, updated_at: new Date().toISOString() }),
    'EX',
    300,
  );
}

async function getProviderStatus(provider) {
  if (!isRedisEnabled()) return null;
  const redis = await getRedis();
  const raw = await redis.get(`tracking:provider-status:${provider}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = {
  cacheKey,
  normalizeLocation,
  setLastPosition,
  getLastPosition,
  setProviderStatus,
  getProviderStatus,
};
