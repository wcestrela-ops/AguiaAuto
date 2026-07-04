const { Pool } = require('pg');
const { getSchema, getDefaults, maskSettings, listSchemas } = require('./schemas');

const CACHE_TTL_MS = 60_000;

class IntegrationStore {
  constructor(databaseUrl) {
    this.pool = new Pool({ connectionString: databaseUrl });
    this.cache = new Map();
    this.cacheExpiry = 0;
  }

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS integration_configs (
        integration_key VARCHAR(50) PRIMARY KEY,
        settings        JSONB NOT NULL DEFAULT '{}',
        enabled         BOOLEAN NOT NULL DEFAULT true,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by      VARCHAR(100)
      );
    `);
  }

  _isCacheValid() {
    return Date.now() < this.cacheExpiry;
  }

  _invalidateCache() {
    this.cache.clear();
    this.cacheExpiry = 0;
  }

  async _loadRow(key) {
    const { rows } = await this.pool.query(
      'SELECT integration_key, settings, enabled, updated_at, updated_by FROM integration_configs WHERE integration_key = $1',
      [key]
    );
    return rows[0] || null;
  }

  async get(key, { useCache = true } = {}) {
    if (useCache && this._isCacheValid() && this.cache.has(key)) {
      return this.cache.get(key);
    }

    const schema = getSchema(key);
    if (!schema) {
      throw new Error(`Integração "${key}" não existe.`);
    }

    const row = await this._loadRow(key);
    const defaults = getDefaults(key);
    const settings = { ...defaults, ...(row?.settings || {}) };

    const config = {
      key,
      label: schema.label,
      description: schema.description,
      enabled: row?.enabled ?? true,
      settings,
      updated_at: row?.updated_at || null,
      updated_by: row?.updated_by || null,
    };

    this.cache.set(key, config);
    this.cacheExpiry = Date.now() + CACHE_TTL_MS;
    return config;
  }

  async getSettings(key) {
    const config = await this.get(key);
    if (!config.enabled) {
      throw new Error(`Integração "${key}" está desabilitada.`);
    }
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

  async update(key, partialSettings, { updatedBy = 'admin', enabled } = {}) {
    const schema = getSchema(key);
    if (!schema) {
      throw new Error(`Integração "${key}" não existe.`);
    }

    const current = await this.get(key, { useCache: false });
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

    await this.pool.query(
      `INSERT INTO integration_configs (integration_key, settings, enabled, updated_at, updated_by)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (integration_key)
       DO UPDATE SET settings = $2, enabled = $3, updated_at = NOW(), updated_by = $4`,
      [key, JSON.stringify(merged), enabledValue, updatedBy]
    );

    this._invalidateCache();
    const updated = await this.get(key, { useCache: false });
    return {
      ...updated,
      settings: maskSettings(key, updated.settings),
    };
  }

  async reload() {
    this._invalidateCache();
    return this.list();
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
