function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isIgnitionOn(value) {
  if (value == null || value === '') return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;

  const normalized = String(value).trim().toLowerCase();
  if (['0', 'false', 'off', 'desligado', 'desligada', 'no'].includes(normalized)) {
    return false;
  }
  if (['1', 'true', 'on', 'ligado', 'ligada', 'yes'].includes(normalized)) {
    return true;
  }
  return Boolean(normalized);
}

function extractLocationFromPayload(payload = {}) {
  const lat = parseFloat(payload.latitude ?? payload.lat);
  const lng = parseFloat(payload.longitude ?? payload.lng ?? payload.lon);
  const ignicao = payload.ignition ?? payload.ignicao ?? payload.engine_status ?? null;

  return {
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    ignicao,
  };
}

module.exports = {
  haversineMeters,
  isIgnitionOn,
  extractLocationFromPayload,
};
