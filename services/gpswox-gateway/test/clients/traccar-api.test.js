const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  TraccarApiClient,
  COMMAND_MAP,
  knotsToKmh,
  formatSpeed,
} = require('../../src/clients/traccar-api');

describe('TraccarApiClient helpers', () => {
  it('mapeia comandos GPSWOX para Traccar', () => {
    const client = new TraccarApiClient({ url: 'https://t.example.com', email: 'a@b.com', password: 'x' });
    assert.equal(client.mapCommandType('engine_stop'), COMMAND_MAP.engine_stop);
    assert.equal(client.mapCommandType('engine_resume'), COMMAND_MAP.engine_resume);
    assert.equal(client.mapCommandType('customCmd'), 'customCmd');
  });

  it('converte nós para km/h', () => {
    assert.equal(knotsToKmh(10), 18.5);
    assert.equal(formatSpeed(10), '18.5 km/h');
  });

  it('enabled exige url e credenciais', () => {
    assert.equal(new TraccarApiClient({}).enabled, false);
    assert.equal(new TraccarApiClient({ url: 'https://t.example.com' }).enabled, false);
    assert.equal(new TraccarApiClient({ url: 'https://t.example.com', email: 'a', password: 'b' }).enabled, true);
    assert.equal(new TraccarApiClient({ url: 'https://t.example.com', api_token: 'tok' }).enabled, true);
  });

  it('normaliza localização com velocidade em km/h', () => {
    const client = new TraccarApiClient({ url: 'https://t.example.com', api_token: 'tok' });
    const result = client.normalizeLocation(
      { id: 42, name: 'ABC-1234', status: 'online' },
      { latitude: -23.55, longitude: -46.63, speed: 10, address: 'São Paulo', fixTime: '2026-01-01T12:00:00Z' },
    );
    assert.equal(result.device_id, 42);
    assert.equal(result.veiculo, 'ABC-1234');
    assert.equal(result.latitude, -23.55);
    assert.equal(result.fonte, 'traccar_api');
    assert.equal(result.velocidade, '18.5 km/h');
    assert.equal(result.online, true);
  });
});

describe('DEFAULT_PROVIDER', () => {
  it('fallback é gpswox quando rastreamento ausente', async () => {
    const { DEFAULT_PROVIDER } = require('../../src/config/provider');
    assert.equal(DEFAULT_PROVIDER, 'gpswox');
  });
});
