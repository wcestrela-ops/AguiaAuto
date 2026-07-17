const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canTransition, COMMAND_STATES, mapLegacyStatus } = require('../../src/infrastructure/command-states');
const { resolvePollIntervalMs } = require('../../src/infrastructure/presence');
const { sanitizeLogMeta } = require('../../src/infrastructure/sanitize-log');

test('command states permitem progressão válida', () => {
  assert.equal(canTransition('REQUESTED', 'QUEUED'), true);
  assert.equal(canTransition('SENDING', 'SENT'), true);
  assert.equal(canTransition('CONFIRMED', 'FAILED'), false);
  assert.equal(COMMAND_STATES.includes('EXPIRED'), true);
});

test('mapLegacyStatus converte status antigos', () => {
  assert.equal(mapLegacyStatus('failed'), 'FAILED');
  assert.equal(mapLegacyStatus('sent'), 'SENT');
  assert.equal(mapLegacyStatus('queued'), 'REQUESTED');
});

test('resolvePollIntervalMs respeita viewers e online', () => {
  assert.equal(resolvePollIntervalMs({ viewers: 2 }), 8000);
  assert.equal(resolvePollIntervalMs({ viewers: 0, online: true }), 45000);
  assert.equal(resolvePollIntervalMs({ viewers: 0, online: false }), 180000);
});

test('sanitizeLogMeta mascara campos sensíveis', () => {
  const sanitized = sanitizeLogMeta({
    cpf: '12345678901',
    token: 'abcdefgh',
    nested: { password: 'secret123' },
    plate: 'ABC1D23',
  });

  assert.match(sanitized.cpf, /\*\*\*8901/);
  assert.match(sanitized.token, /\*\*\*/);
  assert.match(sanitized.nested.password, /\*\*\*/);
  assert.equal(sanitized.plate, 'ABC1D23');
});
