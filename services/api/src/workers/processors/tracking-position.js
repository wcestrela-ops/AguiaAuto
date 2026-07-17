const { getPool } = require('../../db/pool');
const gpswox = require('../../integrations/gpswox-gateway');
const { setLastPosition, setProviderStatus } = require('../../infrastructure/tracking-cache');
const { emitVehiclePositionUpdated } = require('../../infrastructure/websocket');
const { normalizeProviderName } = require('../../lib/tracking-platform');
const logger = require('../../logger');

async function resolveVehicle(jobData) {
  const pool = getPool();
  if (jobData.vehicleDbId) {
    const r = await pool.query(
      `SELECT id, tracker_device_id, tracking_provider
       FROM vehicles WHERE id = $1 LIMIT 1`,
      [jobData.vehicleDbId],
    );
    return r.rows[0] || null;
  }
  if (jobData.vehicleId) {
    const r = await pool.query(
      `SELECT id, tracker_device_id, tracking_provider
       FROM vehicles WHERE id = $1 OR tracker_device_id = $2 LIMIT 1`,
      [jobData.vehicleId, String(jobData.vehicleId)],
    );
    return r.rows[0] || null;
  }
  return null;
}

function mapGatewayLocation(location, vehicle, provider) {
  const lat = parseFloat(location?.latitude ?? location?.lat);
  const lng = parseFloat(location?.longitude ?? location?.lng);
  return {
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    speed: location?.speed ?? location?.velocidade ?? null,
    ignition: location?.ignition ?? location?.ignicao ?? null,
    online: location?.online ?? null,
    provider,
    address: location?.address ?? location?.endereco ?? null,
    device_time: location?.capturado_em ?? location?.device_time ?? location?.time ?? null,
    updated_at: new Date().toISOString(),
    raw: location,
    vehicle_id: vehicle.id,
  };
}

async function processTrackingPosition(job) {
  const vehicle = await resolveVehicle(job.data);
  if (!vehicle?.tracker_device_id) {
    logger.warn('Veículo sem device para job de posição.', { jobId: job.id });
    return { skipped: true };
  }

  const provider = normalizeProviderName(job.data.provider || vehicle.tracking_provider || 'gpswox');
  const started = Date.now();
  const cacheVehicleId = String(vehicle.id);

  try {
    const response = await gpswox.getLocation({
      device_id: vehicle.tracker_device_id,
      provider,
    });
    const location = response?.data || response?.localizacao || response;
    if (!location) {
      await setProviderStatus(provider, { status: 'DEGRADED', latencyMs: Date.now() - started });
      return { empty: true };
    }

    const payload = mapGatewayLocation(location, vehicle, provider);
    await setLastPosition(cacheVehicleId, payload, vehicle);
    await setProviderStatus(provider, { status: 'HEALTHY', latencyMs: Date.now() - started, lastSync: payload.updated_at });
    emitVehiclePositionUpdated(cacheVehicleId, payload);

    return { ok: true, vehicleId: cacheVehicleId };
  } catch (err) {
    await setProviderStatus(provider, { status: 'UNAVAILABLE', latencyMs: Date.now() - started, error: err.message });
    throw err;
  }
}

module.exports = { processTrackingPosition };
