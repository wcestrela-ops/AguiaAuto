const COMMAND_STATES = [
  'REQUESTED',
  'QUEUED',
  'SENDING',
  'SENT',
  'ACKNOWLEDGED',
  'CONFIRMED',
  'FAILED',
  'EXPIRED',
];

const STATES = Object.fromEntries(COMMAND_STATES.map((s) => [s, s]));

const TERMINAL_STATES = new Set(['CONFIRMED', 'FAILED', 'EXPIRED']);

function isValidCommandState(state) {
  return COMMAND_STATES.includes(state);
}

function canTransition(from, to) {
  if (from === to) return true;
  const order = COMMAND_STATES.indexOf(from);
  const next = COMMAND_STATES.indexOf(to);
  if (order < 0 || next < 0) return false;
  if (TERMINAL_STATES.has(from)) return false;
  return next >= order;
}

function mapLegacyStatus(status) {
  if (status === 'failed') return 'FAILED';
  if (status === 'sent') return 'SENT';
  return 'REQUESTED';
}

module.exports = {
  COMMAND_STATES,
  STATES,
  TERMINAL_STATES,
  isValidCommandState,
  canTransition,
  mapLegacyStatus,
};
