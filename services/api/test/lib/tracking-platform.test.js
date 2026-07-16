const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeProviderName,
  getProviderLabel,
  getActiveSyncSettings,
} = require('../../src/lib/tracking-platform');

test('normalizeProviderName defaults to gpswox', () => {
  assert.equal(normalizeProviderName(undefined), 'gpswox');
  assert.equal(normalizeProviderName('traccar'), 'traccar');
  assert.equal(normalizeProviderName('TRACCAR'), 'traccar');
  assert.equal(normalizeProviderName('unknown'), 'gpswox');
});

test('getProviderLabel returns human label', () => {
  assert.equal(getProviderLabel('traccar'), 'Traccar');
  assert.equal(getProviderLabel('gpswox'), 'GPSWOX');
});

test('getActiveSyncSettings reads active platform config', async () => {
  const store = {
    async get(key) {
      if (key === 'rastreamento') {
        return { enabled: true, settings: { provider: 'traccar' } };
      }
      if (key === 'traccar') {
        return {
          enabled: true,
          settings: {
            auto_sync_enabled: true,
            auto_sync_interval_hours: 12,
            default_group_id: 5,
          },
        };
      }
      throw new Error(`unexpected key ${key}`);
    },
  };

  const integrations = require('@aguia/integrations');
  const original = integrations.getStore;
  integrations.getStore = () => store;

  try {
    const settings = await getActiveSyncSettings();
    assert.equal(settings.provider, 'traccar');
    assert.equal(settings.providerLabel, 'Traccar');
    assert.equal(settings.enabled, true);
    assert.equal(settings.intervalHours, 12);
    assert.equal(settings.defaultGroupId, 5);
    assert.equal(settings.configKey, 'traccar');
  } finally {
    integrations.getStore = original;
  }
});
