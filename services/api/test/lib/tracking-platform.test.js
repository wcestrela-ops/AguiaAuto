const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeProviderName,
  getProviderLabel,
  getSyncSettingsForProvider,
} = require('../../src/lib/tracking-platform');

test('normalizeProviderName defaults to gpswox', () => {
  assert.equal(normalizeProviderName(undefined), 'gpswox');
  assert.equal(normalizeProviderName('traccar'), 'traccar');
});

test('getSyncSettingsForProvider reads platform config', async () => {
  const store = {
    async get(key) {
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
    const settings = await getSyncSettingsForProvider('traccar');
    assert.equal(settings.provider, 'traccar');
    assert.equal(settings.enabled, true);
    assert.equal(settings.intervalHours, 12);
  } finally {
    integrations.getStore = original;
  }
});
