const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeTraccarPayload, normalizeTrackingWebhookPayload } = require('../../src/lib/tracking-events');

test('normalizeTraccarPayload maps deviceOverspeed event', () => {
  const result = normalizeTraccarPayload({
    event: {
      id: 42,
      type: 'deviceOverspeed',
      deviceId: 7,
      eventTime: '2026-07-04T12:00:00Z',
    },
    device: { id: 7, name: 'ABC-1234', uniqueId: '359633100000000' },
    position: { speed: 54.5, address: 'Rua Teste' },
  });

  assert.equal(result.device_id, '7');
  assert.equal(result.alert_type, 'velocidade');
  assert.equal(result.source_event_id, '42');
  assert.match(result.message, /ABC-1234/);
});

test('normalizeTrackingWebhookPayload routes by source', () => {
  const gpswox = normalizeTrackingWebhookPayload({ device_id: '1', type: 'overspeed' }, 'gpswox');
  assert.equal(gpswox.alert_type, 'velocidade');

  const traccar = normalizeTrackingWebhookPayload({
    event: { type: 'geofenceEnter', deviceId: 3, id: 9 },
    device: { name: 'Carro' },
  }, 'traccar');
  assert.equal(traccar.alert_type, 'cerca_eletronica');
  assert.equal(traccar.device_id, '3');
});
