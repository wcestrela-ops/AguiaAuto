const { ALERT_TYPES, ALERT_CHANNELS } = require('@aguia/shared');

const ALERT_TYPE_LABELS = {
  ignicao: 'Ignição',
  velocidade: 'Excesso de velocidade',
  cerca_eletronica: 'Cerca eletrônica',
  bateria: 'Bateria baixa',
  movimento: 'Movimento',
  desligamento: 'Desligamento',
  manutencao: 'Manutenção',
  ancora: 'Âncora',
};

const GPSWOX_EVENT_MAP = {
  ignition_on: 'ignicao',
  ignition_off: 'desligamento',
  engine_on: 'ignicao',
  engine_off: 'desligamento',
  overspeed: 'velocidade',
  speed: 'velocidade',
  geofence_in: 'cerca_eletronica',
  geofence_out: 'cerca_eletronica',
  geofence_enter: 'cerca_eletronica',
  geofence_exit: 'cerca_eletronica',
  zone_in: 'cerca_eletronica',
  zone_out: 'cerca_eletronica',
  low_battery: 'bateria',
  battery_low: 'bateria',
  movement: 'movimento',
  move: 'movimento',
  maintenance: 'manutencao',
  sos: 'movimento',
  alarm: 'movimento',
};

function normalizeGpswoxPayload(payload = {}) {
  const deviceId = String(
    payload.device_id || payload.deviceId || payload.imei || payload.id || ''
  ).trim() || null;

  const rawType = String(
    payload.alert_type || payload.type || payload.event || payload.alarm_type || 'movimento'
  ).toLowerCase().replace(/\s+/g, '_');

  const alertType = GPSWOX_EVENT_MAP[rawType] || (
    ALERT_TYPES.includes(rawType) ? rawType : 'movimento'
  );

  const vehicleName = payload.vehicle || payload.veiculo || payload.device_name || payload.name;
  const plate = payload.plate || payload.placa;
  const speed = payload.speed || payload.velocidade;
  const address = payload.address || payload.endereco || payload.location;
  const message = payload.message || payload.msg || payload.description
    || buildDefaultMessage(alertType, { vehicleName, plate, speed, address });

  const sourceEventId = String(
    payload.event_id || payload.id || payload.uuid
    || `${deviceId}-${rawType}-${payload.time || payload.timestamp || Date.now()}`
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

function buildDefaultMessage(type, { vehicleName, plate, speed, address }) {
  const label = vehicleName || plate || 'Seu veículo';
  const parts = [label];

  if (type === 'velocidade' && speed) parts.push(`velocidade: ${speed}`);
  if (type === 'ignicao') parts.push('ignição ligada');
  if (type === 'desligamento') parts.push('ignição desligada');
  if (type === 'cerca_eletronica') parts.push('evento de cerca eletrônica');
  if (type === 'bateria') parts.push('bateria baixa');
  if (type === 'movimento') parts.push('movimento detectado');
  if (type === 'manutencao') parts.push('alerta de manutenção');
  if (type === 'ancora') parts.push('saída da âncora detectada');
  if (address) parts.push(address);

  return parts.join(' — ');
}

module.exports = {
  ALERT_TYPE_LABELS,
  GPSWOX_EVENT_MAP,
  normalizeGpswoxPayload,
  buildDefaultMessage,
};
