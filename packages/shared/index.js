const VEHICLE_STATUS = {
  PENDING_INSTALLATION: 'pending_installation',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
};

const ALERT_CHANNELS = ['push', 'whatsapp', 'email'];

const ALERT_TYPES = [
  'ignicao',
  'velocidade',
  'cerca_eletronica',
  'bateria',
  'movimento',
  'desligamento',
  'manutencao',
  'ancora',
];

module.exports = {
  VEHICLE_STATUS,
  ALERT_CHANNELS,
  ALERT_TYPES,
};
