const DEFAULT_POINTS = 32;

function circleToCoordinates(latitude, longitude, radiusMeters, points = DEFAULT_POINTS) {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  const radius = parseFloat(radiusMeters);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('latitude e longitude são obrigatórios para cerca circular.');
  }
  if (!Number.isFinite(radius) || radius < 1) {
    throw new Error('radius_meters inválido.');
  }

  const earthRadius = 6378137;
  const coords = [];

  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radius * Math.cos(angle);
    const dy = radius * Math.sin(angle);
    const latOffset = (dy / earthRadius) * (180 / Math.PI);
    const lngOffset = (dx / (earthRadius * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
    coords.push({
      lat: Number((lat + latOffset).toFixed(7)),
      lng: Number((lng + lngOffset).toFixed(7)),
    });
  }

  return coords;
}

function normalizeCoordinatesInput(value) {
  if (value == null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return normalizeCoordinatesInput(JSON.parse(trimmed));
    } catch {
      throw new Error('coordinates deve ser JSON válido ou lista de pontos lat/lng.');
    }
  }

  if (!Array.isArray(value) || value.length < 3) {
    throw new Error('coordinates precisa de pelo menos 3 pontos.');
  }

  return value.map((point, index) => {
    if (Array.isArray(point) && point.length >= 2) {
      const lat = parseFloat(point[0]);
      const lng = parseFloat(point[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error(`Ponto ${index + 1} inválido.`);
      }
      return { lat, lng };
    }

    const lat = parseFloat(point.lat ?? point.latitude);
    const lng = parseFloat(point.lng ?? point.longitude ?? point.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error(`Ponto ${index + 1} inválido.`);
    }
    return { lat, lng };
  });
}

function formatCoordinatesForGpswox(coordinates) {
  return JSON.stringify(normalizeCoordinatesInput(coordinates));
}

function normalizeGeofenceRow(row) {
  if (!row) return null;
  let coordinates = row.coordinates;
  if (typeof coordinates === 'string') {
    try {
      coordinates = JSON.parse(coordinates);
    } catch {
      coordinates = row.coordinates;
    }
  }

  return {
    id: row.id,
    name: row.name,
    group_id: row.group_id ?? row.groupId ?? null,
    polygon_color: row.polygon_color || row.color || null,
    active: row.active ?? row.is_active ?? null,
    coordinates,
  };
}

function extractGeofenceItems(response) {
  const container = response?.items?.geofences || response?.items || response?.geofences || response;
  const rows = container?.data || container?.items || container || [];
  const list = Array.isArray(rows) ? rows : Object.values(rows);
  return list.map(normalizeGeofenceRow).filter(Boolean);
}

function normalizeEventRow(row) {
  if (!row) return null;
  const lat = parseFloat(row.lat ?? row.latitude);
  const lng = parseFloat(row.lng ?? row.longitude ?? row.lon);

  return {
    id: row.id,
    device_id: row.device_id ?? row.deviceId ?? null,
    type: row.type || row.alert_type || row.event || null,
    message: row.message || row.title || row.description || null,
    time: row.time || row.server_time || row.device_time || row.created_at || null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    address: row.address || row.location || null,
  };
}

function extractEventItems(response) {
  const container = response?.items?.events || response?.items || response?.events || response;
  const rows = container?.data || container?.items || container || [];
  const list = Array.isArray(rows) ? rows : Object.values(rows);
  return list.map(normalizeEventRow).filter(Boolean);
}

module.exports = {
  circleToCoordinates,
  normalizeCoordinatesInput,
  formatCoordinatesForGpswox,
  normalizeGeofenceRow,
  extractGeofenceItems,
  normalizeEventRow,
  extractEventItems,
};
