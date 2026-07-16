const DEFAULT_PROVIDER = 'gpswox';

const PROVIDER_CONFIG_KEYS = {
  gpswox: 'gpswox',
  traccar: 'traccar',
};

const PROVIDER_LABELS = {
  gpswox: 'GPSWOX',
  traccar: 'Traccar',
};

function getStore() {
  return require('@aguia/integrations').getStore();
}

function normalizeProviderName(value) {
  const name = String(value || DEFAULT_PROVIDER).toLowerCase();
  return name === 'traccar' ? 'traccar' : DEFAULT_PROVIDER;
}

async function getActiveProviderName() {
  const store = getStore();
  try {
    const config = await store.get('rastreamento');
    return normalizeProviderName(config.settings?.provider);
  } catch {
    return DEFAULT_PROVIDER;
  }
}

async function getActivePlatformConfigKey() {
  const provider = await getActiveProviderName();
  return PROVIDER_CONFIG_KEYS[provider] || PROVIDER_CONFIG_KEYS.gpswox;
}

async function getActivePlatformSettings() {
  const provider = await getActiveProviderName();
  const store = getStore();
  const configKey = PROVIDER_CONFIG_KEYS[provider] || PROVIDER_CONFIG_KEYS.gpswox;

  try {
    const config = await store.get(configKey);
    return {
      provider,
      configKey,
      enabled: config.enabled !== false,
      settings: config.settings || {},
    };
  } catch {
    return {
      provider,
      configKey,
      enabled: true,
      settings: {},
    };
  }
}

function getProviderLabel(provider) {
  return PROVIDER_LABELS[normalizeProviderName(provider)] || PROVIDER_LABELS.gpswox;
}

async function getActiveSyncSettings() {
  const platform = await getActivePlatformSettings();
  const { provider, settings, enabled: integrationEnabled } = platform;

  const envPrefix = provider === 'traccar' ? 'TRACCAR' : 'GPSWOX';
  const envEnabled = process.env[`${envPrefix}_AUTO_SYNC_ENABLED`];
  const enabledFromEnv = envEnabled === undefined ? true : envEnabled !== 'false';

  const intervalHours = parseInt(
    settings.auto_sync_interval_hours
    || process.env[`${envPrefix}_AUTO_SYNC_INTERVAL_HOURS`]
    || '24',
    10,
  );

  return {
    provider,
    providerLabel: getProviderLabel(provider),
    configKey: platform.configKey,
    enabled: integrationEnabled
      && settings.auto_sync_enabled !== false
      && enabledFromEnv,
    intervalHours,
    defaultGroupId: settings.default_group_id ?? null,
  };
}

module.exports = {
  DEFAULT_PROVIDER,
  PROVIDER_LABELS,
  normalizeProviderName,
  getActiveProviderName,
  getActivePlatformConfigKey,
  getActivePlatformSettings,
  getProviderLabel,
  getActiveSyncSettings,
};
