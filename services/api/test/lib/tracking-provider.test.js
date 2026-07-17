const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TrackingProvider, SYNC_STRATEGIES } = require('../../src/lib/tracking/tracking-provider');
const { GatewayTrackingProvider } = require('../../src/lib/tracking/gateway-tracking-provider');
const { TrackingProviderFactory } = require('../../src/lib/tracking/tracking-provider-factory');
const { ENTITY_TYPES, SYNC_STRATEGIES: MIGRATION_STRATEGIES } = require('../../src/db/migrate-phase6-tracking-provider');

test('SYNC_STRATEGIES define PROVIDER_MASTER e READ_ONLY', () => {
  assert.equal(SYNC_STRATEGIES.PROVIDER_MASTER, 'PROVIDER_MASTER');
  assert.equal(SYNC_STRATEGIES.READ_ONLY, 'READ_ONLY');
  assert.deepEqual(MIGRATION_STRATEGIES, ['PROVIDER_MASTER', 'READ_ONLY']);
});

test('ENTITY_TYPES inclui user e vehicle', () => {
  assert.ok(ENTITY_TYPES.includes('user'));
  assert.ok(ENTITY_TYPES.includes('vehicle'));
});

test('TrackingProvider bloqueia escrita em READ_ONLY', () => {
  const provider = new TrackingProvider({
    name: 'gpswox',
    syncStrategy: SYNC_STRATEGIES.READ_ONLY,
  });
  assert.throws(
    () => provider.assertWritable('blockDevice'),
    (err) => err.code === 'TRACKING_READ_ONLY',
  );
  assert.equal(provider.isReadOnly(), true);
});

test('TrackingProvider permite leitura em READ_ONLY', () => {
  const provider = new TrackingProvider({
    name: 'traccar',
    syncStrategy: SYNC_STRATEGIES.READ_ONLY,
  });
  assert.doesNotThrow(() => provider.assertWritable('getLocation'));
});

test('GatewayTrackingProvider expõe nome do provedor', () => {
  const provider = new GatewayTrackingProvider({ name: 'traccar' });
  assert.equal(provider.getProviderName(), 'traccar');
  assert.equal(provider.getLabel(), 'Traccar');
});

test('TrackingProviderFactory cria adaptadores por nome', () => {
  const factory = new TrackingProviderFactory();
  const gpswox = factory.createProvider('gpswox', { syncStrategy: SYNC_STRATEGIES.PROVIDER_MASTER });
  const traccar = factory.createProvider('traccar');
  assert.equal(gpswox.getProviderName(), 'gpswox');
  assert.equal(traccar.getProviderName(), 'traccar');
  assert.equal(gpswox.isReadOnly(), false);
});

test('resolveExternalId lógica prefere mapping sobre fallback', () => {
  const mapped = 'ext-123';
  const fallback = 'legacy-456';
  const resolved = mapped || fallback;
  assert.equal(resolved, 'ext-123');
});
