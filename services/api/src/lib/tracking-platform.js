const DEFAULT_PROVIDER = 'gpswox';

const PROVIDER_CONFIG_KEYS = {
  gpswox: 'gpswox',
  traccar: 'traccar',
};

const PROVIDER_LABELS = {
  gpswox: 'GPSWOX',
  traccar: 'Traccar',
};

const TRACKING_PROVIDERS = ['gpswox', 'traccar'];

function getStore() {
  return require('@aguia/integrations').getStore();
}

function normalizeProviderName(value) {
  const name = String(value || DEFAULT_PROVIDER).toLowerCase();
  return name === 'traccar' ? 'traccar' : DEFAULT_PROVIDER;
}

async function getDefaultProviderName() {
  const store = getStore();
  try {
    const config = await store.get('rastreamento');
    return normalizeProviderName(config.settings?.default_provider || config.settings?.provider);
  } catch {
    return DEFAULT_PROVIDER;
  }
}

/** @deprecated use getDefaultProviderName — plataforma global não roteia mais comandos */
async function getActiveProviderName() {
  return getDefaultProviderName();
}

async function getPlatformSettings(provider) {
  const name = normalizeProviderName(provider);
  const store = getStore();
  const configKey = PROVIDER_CONFIG_KEYS[name];

  try {
    const config = await store.get(configKey);
    return {
      provider: name,
      configKey,
      enabled: config.enabled !== false,
      settings: config.settings || {},
    };
  } catch {
    return {
      provider: name,
      configKey,
      enabled: true,
      settings: {},
    };
  }
}

async function getActivePlatformSettings() {
  return getPlatformSettings(await getDefaultProviderName());
}

function getProviderLabel(provider) {
  return PROVIDER_LABELS[normalizeProviderName(provider)] || PROVIDER_LABELS.gpswox;
}

async function getSyncSettingsForProvider(provider) {
  const platform = await getPlatformSettings(provider);
  const { settings, enabled: integrationEnabled } = platform;

  const envPrefix = platform.provider === 'traccar' ? 'TRACCAR' : 'GPSWOX';
  const envEnabled = process.env[`${envPrefix}_AUTO_SYNC_ENABLED`];
  const enabledFromEnv = envEnabled === undefined ? true : envEnabled !== 'false';

  const intervalHours = parseInt(
    settings.auto_sync_interval_hours
    || process.env[`${envPrefix}_AUTO_SYNC_INTERVAL_HOURS`]
    || '24',
    10,
  );

  return {
    provider: platform.provider,
    providerLabel: getProviderLabel(platform.provider),
    configKey: platform.configKey,
    enabled: integrationEnabled
      && settings.auto_sync_enabled !== false
      && enabledFromEnv,
    intervalHours,
    defaultGroupId: settings.default_group_id ?? null,
  };
}

async function getAllSyncSettings() {
  const platforms = await Promise.all(
    TRACKING_PROVIDERS.map((provider) => getSyncSettingsForProvider(provider)),
  );
  return platforms;
}

/** @deprecated use getSyncSettingsForProvider(provider) */
async function getActiveSyncSettings() {
  return getSyncSettingsForProvider(await getDefaultProviderName());
}

function platformUserIdColumn(provider) {
  return normalizeProviderName(provider) === 'traccar' ? 'traccar_user_id' : 'gpswox_user_id';
}

module.exports = {
  DEFAULT_PROVIDER,
  PROVIDER_LABELS,
  TRACKING_PROVIDERS,
  normalizeProviderName,
  getDefaultProviderName,
  getActiveProviderName,
  getPlatformSettings,
  getActivePlatformSettings,
  getProviderLabel,
  getSyncSettingsForProvider,
  getAllSyncSettings,
  getActiveSyncSettings,
  platformUserIdColumn,
};
