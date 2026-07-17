const { Pool } = require('pg');
const { getSchema, getDefaults, maskSettings, listSchemas } = require('./schemas');
const { encryptJson, decryptJson, isEncryptionEnabled } = require('./encryption');

const CACHE_TTL_MS = 60_000;
const DEFAULT_TENANT_ID = 1;

class IntegrationStore {
  constructor(databaseUrl) {
    this.pool = new Pool({ connectionString: databaseUrl });
    this.cache = new Map();
    this.cacheExpiry = 0;
  }

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS integration_configs (
        tenant_id       INTEGER NOT NULL DEFAULT 1,
        integration_key VARCHAR(50) NOT NULL,
        settings        JSONB NOT NULL DEFAULT '{}',
        enabled         BOOLEAN NOT NULL DEFAULT true,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by      VARCHAR(100),
        PRIMARY KEY (tenant_id, integration_key)
      );
    `);
  }

  _cacheKey(tenantId, key) {
    return `${tenantId || DEFAULT_TENANT_ID}:${key}`;
  }

  _isCacheValid() {
    return Date.now() < this.cacheExpiry;
  }

  _invalidateCache() {
    this.cache.clear();
    this.cacheExpiry = 0;
  }

  async _loadRow(key, tenantId = DEFAULT_TENANT_ID) {
    const { rows } = await this.pool.query(
      'SELECT integration_key, settings, settings_encrypted, enabled, updated_at, updated_by, tenant_id FROM integration_configs WHERE tenant_id = $1 AND integration_key = $2',
      [tenantId, key]
    );
    return rows[0] || null;
  }

  _resolveSettings(row, defaults) {
    if (row?.settings_encrypted && isEncryptionEnabled()) {
      const decrypted = decryptJson(row.settings_encrypted);
      if (decrypted && typeof decrypted === 'object') {
        return { ...defaults, ...decrypted };
      }
    }
    return { ...defaults, ...(row?.settings || {}) };
  }

  _splitSecretSettings(key, settings) {
    const schema = getSchema(key);
    if (!schema || !isEncryptionEnabled()) {
      return { publicSettings: settings, encryptedBlob: null };
    }

    const secretKeys = new Set(schema.fields.filter((f) => f.secret).map((f) => f.key));
    const secrets = {};
    const publicSettings = { ...settings };

    for (const secretKey of secretKeys) {
      if (publicSettings[secretKey] != null && publicSettings[secretKey] !== '') {
        secrets[secretKey] = publicSettings[secretKey];
      }
      delete publicSettings[secretKey];
    }

    const encryptedBlob = Object.keys(secrets).length ? encryptJson(secrets) : null;
    return { publicSettings, encryptedBlob };
  }

  async migrateEncryptedSettings() {
    if (!isEncryptionEnabled()) return { migrated: 0 };

    const { rows } = await this.pool.query(
      `SELECT integration_key, settings, settings_encrypted
       FROM integration_configs
       WHERE settings_encrypted IS NULL AND settings <> '{}'::jsonb`,
    );

    let migrated = 0;
    for (const row of rows) {
      const schema = getSchema(row.integration_key);
      if (!schema) continue;
      const { publicSettings, encryptedBlob } = this._splitSecretSettings(row.integration_key, row.settings);
      if (!encryptedBlob) continue;

      await this.pool.query(
        `UPDATE integration_configs
         SET settings = $3, settings_encrypted = $4, updated_at = NOW()
         WHERE tenant_id = $1 AND integration_key = $2`,
        [row.tenant_id || DEFAULT_TENANT_ID, row.integration_key, JSON.stringify(publicSettings), encryptedBlob],
      );
      migrated += 1;
    }

    this._invalidateCache();
    return { migrated };
  }

  async get(key, { useCache = true, tenantId = DEFAULT_TENANT_ID } = {}) {
    const cacheKey = this._cacheKey(tenantId, key);
    if (useCache && this._isCacheValid() && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const schema = getSchema(key);
    if (!schema) {
      throw new Error(`Integração "${key}" não existe.`);
    }

    const row = await this._loadRow(key, tenantId);
    const defaults = getDefaults(key);
    const settings = this._resolveSettings(row, defaults);

    const config = {
      key,
      tenant_id: tenantId,
      label: schema.label,
      description: schema.description,
      enabled: row?.enabled ?? true,
      settings,
      updated_at: row?.updated_at || null,
      updated_by: row?.updated_by || null,
    };

    this.cache.set(cacheKey, config);
    this.cacheExpiry = Date.now() + CACHE_TTL_MS;
    return config;
  }

  async getSettings(key, { tenantId = DEFAULT_TENANT_ID } = {}) {
    const config = await this.get(key, { tenantId });
    if (!config.enabled) {
      throw new Error(`Integração "${key}" está desabilitada.`);
    }
    return config.settings;
  }

  async list({ masked = true, tenantId = DEFAULT_TENANT_ID } = {}) {
    const schemas = listSchemas();
    const items = [];

    for (const schema of schemas) {
      const config = await this.get(schema.key, { tenantId });
      items.push({
        key: config.key,
        label: config.label,
        description: config.description,
        enabled: config.enabled,
        configured: Object.keys(config.settings).some(k => config.settings[k] != null && config.settings[k] !== ''),
        settings: masked ? maskSettings(config.key, config.settings) : config.settings,
        fields: schema.fields,
        updated_at: config.updated_at,
        updated_by: config.updated_by,
      });
    }

    return items;
  }

  async update(key, partialSettings, { updatedBy = 'admin', enabled, tenantId = DEFAULT_TENANT_ID } = {}) {
    const schema = getSchema(key);
    if (!schema) {
      throw new Error(`Integração "${key}" não existe.`);
    }

    const current = await this.get(key, { useCache: false, tenantId });
    const merged = { ...current.settings };

    for (const [field, value] of Object.entries(partialSettings)) {
      const fieldSchema = schema.fields.find(f => f.key === field);
      if (!fieldSchema) continue;

      if (value === '' || value === null || value === undefined) {
        delete merged[field];
        continue;
      }

      if (fieldSchema.type === 'boolean') {
        merged[field] = value === true || value === 'true';
      } else if (fieldSchema.type === 'number') {
        merged[field] = parseInt(value, 10);
      } else {
        merged[field] = value;
      }
    }

    const enabledValue = enabled !== undefined ? enabled : current.enabled;
    const { publicSettings, encryptedBlob } = this._splitSecretSettings(key, merged);

    await this.pool.query(
      `INSERT INTO integration_configs (tenant_id, integration_key, settings, settings_encrypted, enabled, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       ON CONFLICT (tenant_id, integration_key)
       DO UPDATE SET settings = $3, settings_encrypted = COALESCE($4, integration_configs.settings_encrypted),
                     enabled = $5, updated_at = NOW(), updated_by = $6`,
      [tenantId, key, JSON.stringify(publicSettings), encryptedBlob, enabledValue, updatedBy]
    );

    this._invalidateCache();
    const updated = await this.get(key, { useCache: false, tenantId });
    return {
      ...updated,
      settings: maskSettings(key, updated.settings),
    };
  }

  async reload({ tenantId = DEFAULT_TENANT_ID } = {}) {
    this._invalidateCache();
    return this.list({ tenantId });
  }

  async close() {
    await this.pool.end();
  }
}

let instance = null;

class EnvFallbackStore {
  async migrate() {}

  async get(key) {
    const schema = getSchema(key);
    if (!schema) throw new Error(`Integração "${key}" não existe.`);

    return {
      key,
      label: schema.label,
      description: schema.description,
      enabled: true,
      settings: getDefaults(key),
      updated_at: null,
      updated_by: null,
    };
  }

  async getSettings(key) {
    const config = await this.get(key);
    return config.settings;
  }

  async list({ masked = true } = {}) {
    const schemas = listSchemas();
    const items = [];

    for (const schema of schemas) {
      const config = await this.get(schema.key);
      items.push({
        key: config.key,
        label: config.label,
        description: config.description,
        enabled: true,
        configured: Object.keys(config.settings).length > 0,
        settings: masked ? maskSettings(config.key, config.settings) : config.settings,
        fields: schema.fields,
        updated_at: null,
        updated_by: null,
      });
    }

    return items;
  }

  async update() {
    throw new Error('Configure DATABASE_URL para salvar integrações pelo painel admin.');
  }

  async reload() {
    return this.list();
  }

  async close() {}
}

function getStore(databaseUrl = process.env.DATABASE_URL) {
  if (!instance) {
    instance = databaseUrl
      ? new IntegrationStore(databaseUrl)
      : new EnvFallbackStore();
  }
  return instance;
}

module.exports = { IntegrationStore, getStore };
