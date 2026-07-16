const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  circleToCoordinates,
  formatCoordinatesForGpswox,
  normalizeCoordinatesInput,
  extractGeofenceItems,
  extractEventItems,
} = require('../../src/lib/geofence');

describe('geofence helpers', () => {
  it('gera polígono circular com pontos suficientes', () => {
    const coords = circleToCoordinates(-23.5505, -46.6333, 100, 8);
    assert.equal(coords.length, 8);
    coords.forEach((point) => {
      assert.ok(Number.isFinite(point.lat));
      assert.ok(Number.isFinite(point.lng));
    });
  });

  it('normaliza coordinates a partir de array lat/lng', () => {
    const normalized = normalizeCoordinatesInput([
      { lat: -23.55, lng: -46.63 },
      { lat: -23.56, lng: -46.64 },
      { lat: -23.57, lng: -46.65 },
    ]);
    assert.equal(normalized.length, 3);
  });

  it('formata coordinates como JSON string para GPSWOX', () => {
    const formatted = formatCoordinatesForGpswox([
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 },
      { lat: 5, lng: 6 },
    ]);
    assert.match(formatted, /^\[/);
    assert.doesNotThrow(() => JSON.parse(formatted));
  });

  it('extrai geofences da resposta paginada', () => {
    const items = extractGeofenceItems({
      items: {
        geofences: {
          data: [{ id: 1, name: 'Centro', coordinates: '[]' }],
        },
      },
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].name, 'Centro');
  });

  it('extrai eventos da resposta GPSWOX', () => {
    const events = extractEventItems({
      items: {
        events: {
          data: [{
            id: 9,
            device_id: 123,
            type: 'geofence_in',
            message: 'Entrou na cerca',
            lat: -23.5,
            lng: -46.6,
            time: '2026-01-01 10:00:00',
          }],
        },
      },
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'geofence_in');
    assert.equal(events[0].latitude, -23.5);
  });
});
