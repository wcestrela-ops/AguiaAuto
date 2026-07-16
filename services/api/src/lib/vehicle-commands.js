const VEHICLE_COMMANDS = {
  bloquear: { gpswox: 'engine_stop', sms: 'RELAY,1#', label: 'Bloquear veículo' },
  desbloquear: { gpswox: 'engine_resume', sms: 'RELAY,0#', label: 'Desbloquear veículo' },
  ligar: { gpswox: 'engine_resume', sms: 'RELAY,0#', label: 'Ligar motor' },
  desligar: { gpswox: 'engine_stop', sms: 'RELAY,1#', label: 'Desligar motor' },
  localizar: { gpswox: 'position_single', sms: 'WHERE#', label: 'Solicitar localização' },
};

function normalizeVehicleAction(action) {
  const key = String(action || '').toLowerCase();
  return VEHICLE_COMMANDS[key] ? key : null;
}

module.exports = { VEHICLE_COMMANDS, normalizeVehicleAction };
