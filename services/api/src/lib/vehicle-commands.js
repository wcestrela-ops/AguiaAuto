const VEHICLE_COMMANDS = {
  bloquear: { gpswox: 'engine_stop', label: 'Bloquear veículo' },
  desbloquear: { gpswox: 'engine_resume', label: 'Desbloquear veículo' },
  ligar: { gpswox: 'engine_resume', label: 'Ligar motor' },
  desligar: { gpswox: 'engine_stop', label: 'Desligar motor' },
  localizar: { gpswox: 'position_single', label: 'Solicitar localização' },
};

function normalizeVehicleAction(action) {
  const key = String(action || '').toLowerCase();
  return VEHICLE_COMMANDS[key] ? key : null;
}

module.exports = { VEHICLE_COMMANDS, normalizeVehicleAction };
