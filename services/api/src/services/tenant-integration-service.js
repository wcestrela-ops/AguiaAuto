const { getPool } = require('../db/pool');
const { getStore, isSharedCapable, getSchema, maskSettings } = require('@aguia/integrations');
const { isMultiTenantEnabled, DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

const PLATFORM_TENANT_ID = DEFAULT_TENANT_ID;
const CREDENTIAL_MODES = {
  SHARED: 'SHARED',
  OWN: 'OWN',
};

function mergeNonSecretSettings(key, baseSettings, tenantSettings) {
  if (!tenantSettings || typeof tenantSettings !== 'object') return { ...baseSettings };
  const schema = getSchema(key);
  const secretKeys = new Set((schema?.fields || []).filter((f) => f.secret).map((f) => f.key));
  const merged = { ...baseSettings };
  for (const [field, value] of Object.entries(tenantSettings)) {
    if (secretKeys.has(field)) continue;
    if (value !== undefined && value !== null && value !== '') {
      merged[field] = value;
    }
  }
  return merged;
}

class TenantIntegrationService {
  constructor() {
    this.store = getStore();
  }

  isSharedCapable(key) {
    return isSharedCapable(key);
  }

  defaultCredentialMode(tenantId) {
    if (!isMultiTenantEnabled() || tenantId === PLATFORM_TENANT_ID) {
      return CREDENTIAL_MODES.OWN;
    }
    return CREDENTIAL_MODES.SHARED;
  }

  async resolveConfig(key, tenantId = PLATFORM_TENANT_ID) {
    const store = this.store;
    const tenantConfig = await store.get(key, { useCache: false, tenantId });
    const mode = tenantConfig.credential_mode || this.defaultCredentialMode(tenantId);

    if (
      isMultiTenantEnabled()
      && tenantId !== PLATFORM_TENANT_ID
      && mode === CREDENTIAL_MODES.SHARED
      && this.isSharedCapable(key)
    ) {
      const platformConfig = await store.get(key, { useCache: false, tenantId: PLATFORM_TENANT_ID });
      return {
        ...platformConfig,
        tenant_id: tenantId,
        credential_mode: CREDENTIAL_MODES.SHARED,
        shared_capable: true,
        resolved_from: PLATFORM_TENANT_ID,
        enabled: tenantConfig.enabled ?? platformConfig.enabled,
        settings: mergeNonSecretSettings(key, platformConfig.settings, tenantConfig.settings),
        settings_masked: maskSettings(key, mergeNonSecretSettings(key, platformConfig.settings, tenantConfig.settings)),
      };
    }

    return {
      ...tenantConfig,
      credential_mode: mode,
      resolved_from: tenantId,
      settings_masked: maskSettings(key, tenantConfig.settings),
    };
  }

  async getSettings(key, tenantId = PLATFORM_TENANT_ID) {
    const config = await this.resolveConfig(key, tenantId);
    if (!config.enabled) {
      throw new Error(`Integração "${key}" está desabilitada para esta empresa.`);
    }
    return config.settings;
  }

  async listForTenant(tenantId = PLATFORM_TENANT_ID, { masked = true } = {}) {
    const items = await this.store.list({ masked: false, tenantId });
    const resolved = [];

    for (const item of items) {
      if (['gateway', 'gateway_client'].includes(item.key)) continue;
      const config = await this.resolveConfig(item.key, tenantId);
      resolved.push({
        key: config.key,
        label: config.label,
        description: config.description,
        enabled: config.enabled,
        credential_mode: config.credential_mode,
        shared_capable: config.shared_capable,
        resolved_from: config.resolved_from,
        configured: Object.keys(config.settings).some((k) => config.settings[k] != null && config.settings[k] !== ''),
        settings: masked ? maskSettings(config.key, config.settings) : config.settings,
        fields: item.fields,
        updated_at: item.updated_at,
        updated_by: item.updated_by,
      });
    }

    return resolved;
  }

  async updateForTenant(key, partialSettings, {
    tenantId = PLATFORM_TENANT_ID,
    enabled,
    credentialMode,
    updatedBy = 'admin',
  } = {}) {
    const current = await this.store.get(key, { useCache: false, tenantId });
    const nextMode = credentialMode || current.credential_mode || this.defaultCredentialMode(tenantId);

    if (nextMode === CREDENTIAL_MODES.SHARED && tenantId !== PLATFORM_TENANT_ID) {
      const schema = getSchema(key);
      const secretKeys = new Set((schema?.fields || []).filter((f) => f.secret).map((f) => f.key));
      for (const secretKey of secretKeys) {
        if (partialSettings?.[secretKey] != null && partialSettings[secretKey] !== '') {
          const err = new Error('Credenciais próprias exigem modo OWN_CREDENTIALS. Altere o modo antes de salvar segredos.');
          err.code = 'INTEGRATION_SHARED_MODE';
          err.statusCode = 400;
          throw err;
        }
      }
    }

    return this.store.update(key, partialSettings || {}, {
      enabled,
      tenantId,
      credentialMode: nextMode,
      updatedBy,
    });
  }

  async setCredentialMode(key, tenantId, credentialMode) {
    if (!Object.values(CREDENTIAL_MODES).includes(credentialMode)) {
      throw new Error(`Modo de credencial inválido: ${credentialMode}`);
    }
    if (!this.isSharedCapable(key)) {
      throw new Error(`Integração "${key}" não suporta modo compartilhado.`);
    }
    const current = await this.store.get(key, { useCache: false, tenantId });
    return this.store.update(key, current.settings, {
      tenantId,
      credentialMode,
      enabled: current.enabled,
      updatedBy: 'platform',
    });
  }

  async seedSharedIntegrationsForTenant(tenantId) {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO integration_configs (tenant_id, integration_key, settings, enabled, credential_mode)
       SELECT $1, ic.integration_key, '{}'::jsonb, ic.enabled, 'SHARED'
       FROM integration_configs ic
       WHERE ic.tenant_id = $2
         AND ic.integration_key NOT IN ('gateway', 'gateway_client')
       ON CONFLICT (tenant_id, integration_key) DO NOTHING`,
      [tenantId, PLATFORM_TENANT_ID],
    );

    await pool.query(
      `INSERT INTO tenant_tracking_configs (tenant_id, default_provider, sync_strategy)
       VALUES ($1, 'gpswox', 'PROVIDER_MASTER')
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId],
    );

    return { integrations_seeded: result.rowCount };
  }
}

let instance = null;

function getTenantIntegrationService() {
  if (!instance) instance = new TenantIntegrationService();
  return instance;
}

module.exports = {
  TenantIntegrationService,
  getTenantIntegrationService,
  CREDENTIAL_MODES,
  PLATFORM_TENANT_ID,
  mergeNonSecretSettings,
};
