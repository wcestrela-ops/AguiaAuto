const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeProviderName,
  getProviderLabel,
  getSyncSettingsForProvider,
  formatHistoryDateTime,
  defaultHistoryRange,
  missingTrackerDeviceError,
  MISSING_TRACKER_DEVICE_ERROR,
} = require('../../src/lib/tracking-platform');

test('formatHistoryDateTime uses ISO for Traccar and GPSWOX format otherwise', () => {
  const date = new Date('2026-07-04T15:30:45.000Z');
  assert.match(formatHistoryDateTime(date, 'traccar'), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  assert.match(formatHistoryDateTime(date, 'gpswox'), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('defaultHistoryRange formats dates per provider', () => {
  const gpswoxRange = defaultHistoryRange(24, 'gpswox');
  const traccarRange = defaultHistoryRange(24, 'traccar');
  assert.match(gpswoxRange.from, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.match(traccarRange.from, /^\d{4}-\d{2}-\d{2}T/);
});

test('missingTrackerDeviceError includes provider label when given', () => {
  assert.match(missingTrackerDeviceError('traccar'), /Traccar/);
  assert.equal(missingTrackerDeviceError(), MISSING_TRACKER_DEVICE_ERROR);
});

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
