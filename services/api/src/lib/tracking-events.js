const {
  ALERT_TYPE_LABELS,
  GPSWOX_EVENT_MAP,
  normalizeGpswoxPayload,
  buildDefaultMessage,
} = require('./gpswox-events');

const TRACCAR_EVENT_MAP = {
  deviceonline: 'movimento',
  deviceoffline: 'desligamento',
  devicemoving: 'movimento',
  devicestopped: 'movimento',
  deviceoverspeed: 'velocidade',
  devicefueldrop: 'bateria',
  geofenceenter: 'cerca_eletronica',
  geofenceexit: 'cerca_eletronica',
  ignitionon: 'ignicao',
  ignitionoff: 'desligamento',
  alarm: 'movimento',
  maintenance: 'manutencao',
  textmessage: 'movimento',
};

function normalizeTraccarPayload(payload = {}) {
  const event = payload.event || payload;
  const device = payload.device || {};
  const position = payload.position || {};

  const deviceId = String(
    event.deviceId
    || device.id
    || payload.deviceId
    || payload.device_id
    || device.uniqueId
    || '',
  ).trim() || null;

  const rawType = String(
    event.type
    || payload.type
    || payload.alert_type
    || 'movimento',
  ).toLowerCase().replace(/[^a-z0-9_]/g, '');

  const alertType = TRACCAR_EVENT_MAP[rawType]
    || GPSWOX_EVENT_MAP[rawType]
    || 'movimento';

  const vehicleName = device.name || payload.device_name || payload.name;
  const plate = device.contact || payload.plate || payload.placa;
  const speedKnots = position.speed ?? event.attributes?.speed;
  const speed = speedKnots != null
    ? `${Math.round(Number(speedKnots) * 1.852 * 10) / 10} km/h`
    : payload.speed || payload.velocidade;
  const address = position.address || payload.address || payload.endereco;

  const message = payload.message || payload.msg || event.attributes?.message
    || buildDefaultMessage(alertType, { vehicleName, plate, speed, address });

  const sourceEventId = String(
    event.id
    || payload.event_id
    || payload.id
    || `${deviceId}-${rawType}-${event.eventTime || event.serverTime || Date.now()}`
  );

  return {
    device_id: deviceId,
    alert_type: alertType,
    title: ALERT_TYPE_LABELS[alertType] || 'Alerta do veículo',
    message,
    source_event_id: sourceEventId,
    payload,
  };
}

function normalizeTrackingWebhookPayload(payload = {}, source = 'gpswox') {
  if (source === 'traccar') {
    return normalizeTraccarPayload(payload);
  }
  return normalizeGpswoxPayload(payload);
}

module.exports = {
  TRACCAR_EVENT_MAP,
  normalizeTraccarPayload,
  normalizeTrackingWebhookPayload,
};
