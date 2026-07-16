const { Pool } = require('pg');
const { maskProvider } = require('./schemas');

class SmsRepository {
  constructor(databaseUrl) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS sms_providers (
        id              SERIAL PRIMARY KEY,
        provider        VARCHAR(30) NOT NULL,
        name            VARCHAR(120) NOT NULL DEFAULT 'Gateway SMS',
        enabled         BOOLEAN NOT NULL DEFAULT true,
        is_primary      BOOLEAN NOT NULL DEFAULT false,
        is_backup       BOOLEAN NOT NULL DEFAULT false,
        base_url        TEXT,
        api_key         TEXT,
        device_id       TEXT,
        sender_id       TEXT,
        status          VARCHAR(30) DEFAULT 'unknown',
        last_connection TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sms_providers_primary ON sms_providers (is_primary) WHERE is_primary = true;
      CREATE INDEX IF NOT EXISTS idx_sms_providers_backup ON sms_providers (is_backup) WHERE is_backup = true;

      CREATE TABLE IF NOT EXISTS sms_logs (
        id              SERIAL PRIMARY KEY,
        provider_id     INTEGER REFERENCES sms_providers(id) ON DELETE SET NULL,
        provider_type   VARCHAR(30) NOT NULL,
        action          VARCHAR(50) NOT NULL,
        recipient       VARCHAR(30),
        vehicle_id      INTEGER,
        user_ref        VARCHAR(100),
        success         BOOLEAN NOT NULL,
        response_time   INTEGER,
        error_message   TEXT,
        used_failover   BOOLEAN NOT NULL DEFAULT false,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sms_dispatches (
        id               SERIAL PRIMARY KEY,
        idempotency_key  VARCHAR(128),
        phone            VARCHAR(30) NOT NULL,
        message          TEXT NOT NULL,
        action           VARCHAR(50),
        vehicle_id       INTEGER,
        user_id          INTEGER,
        provider_id      INTEGER REFERENCES sms_providers(id) ON DELETE SET NULL,
        provider_type    VARCHAR(30),
        status           VARCHAR(30) NOT NULL DEFAULT 'queued',
        external_id      VARCHAR(100),
        error_message    TEXT,
        source           VARCHAR(50) DEFAULT 'aguia',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_dispatches_idempotency
        ON sms_dispatches (idempotency_key)
        WHERE idempotency_key IS NOT NULL;

      ALTER TABLE sms_providers ADD COLUMN IF NOT EXISTS url_template TEXT;
      ALTER TABLE sms_providers ADD COLUMN IF NOT EXISTS http_method VARCHAR(10) DEFAULT 'GET';
    `);
  }

  async ensureDefaultProvider() {
    const { rows } = await this.pool.query('SELECT id FROM sms_providers LIMIT 1');
    if (rows.length > 0) return rows[0];

    const { rows: created } = await this.pool.query(
      `INSERT INTO sms_providers (provider, name, enabled, is_primary, status)
       VALUES ('fake', 'Gateway Simulado', true, true, 'connected')
       RETURNING id`
    );
    return created[0];
  }

  async list({ masked = true } = {}) {
    const { rows } = await this.pool.query(
      'SELECT * FROM sms_providers ORDER BY is_primary DESC, is_backup DESC, id ASC'
    );
    return masked ? rows.map(maskProvider) : rows;
  }

  async findById(id) {
    const { rows } = await this.pool.query('SELECT * FROM sms_providers WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async getFailoverChain() {
    const { rows } = await this.pool.query(`
      SELECT * FROM sms_providers
      WHERE enabled = true AND (is_primary = true OR is_backup = true)
      ORDER BY is_primary DESC, is_backup DESC, id ASC
    `);
    return rows;
  }

  async create(data) {
    const normalized = this._normalizeProviderData(data);
    const { rows } = await this.pool.query(
      `INSERT INTO sms_providers (
        provider, name, enabled, is_primary, is_backup,
        base_url, api_key, device_id, sender_id, url_template, http_method, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        normalized.provider,
        normalized.name || 'Gateway SMS',
        normalized.enabled ?? true,
        normalized.is_primary ?? false,
        normalized.is_backup ?? false,
        normalized.base_url || null,
        normalized.api_key || null,
        normalized.device_id || null,
        normalized.sender_id || null,
        normalized.url_template || null,
        normalized.http_method || 'GET',
        normalized.status || 'unknown',
      ]
    );
    return rows[0];
  }

  _normalizeProviderData(data) {
    const copy = { ...data };
    if (copy.provider === 'http_gateway' && copy.url_template && !copy.base_url) {
      copy.base_url = copy.url_template;
    }
    if (copy.provider === 'http_gateway' && !copy.url_template && copy.base_url) {
      copy.url_template = copy.base_url;
    }
    return copy;
  }

  async update(id, data) {
    const current = await this.findById(id);
    if (!current) throw new Error('Provedor não encontrado.');

    const merged = this._normalizeProviderData({ ...current, ...data, id: current.id });
    const { rows } = await this.pool.query(
      `UPDATE sms_providers SET
        provider = $2, name = $3, enabled = $4, is_primary = $5, is_backup = $6,
        base_url = $7, api_key = $8, device_id = $9, sender_id = $10,
        url_template = $11, http_method = $12,
        status = $13, updated_at = NOW()
      WHERE id = $1 RETURNING *`,
      [
        id, merged.provider, merged.name, merged.enabled, merged.is_primary, merged.is_backup,
        merged.base_url, merged.api_key, merged.device_id, merged.sender_id,
        merged.url_template, merged.http_method || 'GET',
        merged.status || current.status,
      ]
    );
    return rows[0];
  }

  async setPrimary(id) {
    await this.pool.query('UPDATE sms_providers SET is_primary = false WHERE is_primary = true');
    const { rows } = await this.pool.query(
      'UPDATE sms_providers SET is_primary = true, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    if (!rows[0]) throw new Error('Provedor não encontrado.');
    return rows[0];
  }

  async setBackup(id) {
    await this.pool.query('UPDATE sms_providers SET is_backup = false WHERE is_backup = true');
    const { rows } = await this.pool.query(
      'UPDATE sms_providers SET is_backup = true, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    if (!rows[0]) throw new Error('Provedor não encontrado.');
    return rows[0];
  }

  async updateStatus(id, status) {
    await this.pool.query(
      'UPDATE sms_providers SET status = $2, last_connection = NOW(), updated_at = NOW() WHERE id = $1',
      [id, status]
    );
  }

  async delete(id) {
    const { rowCount } = await this.pool.query('DELETE FROM sms_providers WHERE id = $1', [id]);
    if (!rowCount) throw new Error('Provedor não encontrado.');
  }

  async log(entry) {
    await this.pool.query(
      `INSERT INTO sms_logs (
        provider_id, provider_type, action, recipient, vehicle_id, user_ref,
        success, response_time, error_message, used_failover
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        entry.provider_id, entry.provider_type, entry.action, entry.recipient,
        entry.vehicle_id || null, entry.user_ref || null,
        entry.success, entry.response_time, entry.error_message,
        entry.used_failover || false,
      ]
    );
  }

  async findDispatchByIdempotency(key) {
    const { rows } = await this.pool.query(
      'SELECT * FROM sms_dispatches WHERE idempotency_key = $1',
      [key]
    );
    return rows[0] || null;
  }

  async createDispatch(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO sms_dispatches (
        idempotency_key, phone, message, action, vehicle_id, user_id,
        provider_id, provider_type, status, external_id, error_message, source
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        data.idempotency_key || null,
        data.phone,
        data.message,
        data.action || null,
        data.vehicle_id || null,
        data.user_id || null,
        data.provider_id || null,
        data.provider_type || null,
        data.status || 'queued',
        data.external_id || null,
        data.error_message || null,
        data.source || 'aguia',
      ]
    );
    return rows[0];
  }

  async updateDispatch(id, data) {
    const { rows } = await this.pool.query(
      `UPDATE sms_dispatches SET
        provider_id = COALESCE($2, provider_id),
        provider_type = COALESCE($3, provider_type),
        status = COALESCE($4, status),
        external_id = COALESCE($5, external_id),
        error_message = COALESCE($6, error_message)
      WHERE id = $1 RETURNING *`,
      [id, data.provider_id, data.provider_type, data.status, data.external_id, data.error_message]
    );
    return rows[0] || null;
  }

  async findDispatchById(id) {
    const { rows } = await this.pool.query('SELECT * FROM sms_dispatches WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async listDispatches({ limit = 50, vehicleId } = {}) {
    const params = [Math.min(limit, 200)];
    let sql = 'SELECT * FROM sms_dispatches';
    if (vehicleId) {
      sql += ' WHERE vehicle_id = $2';
      params.push(vehicleId);
    }
    sql += ' ORDER BY created_at DESC LIMIT $1';
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async close() {
    await this.pool.end();
  }
}

let instance = null;

function getRepository(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL é obrigatória para o módulo SMS.');
  }
  if (!instance) {
    instance = new SmsRepository(databaseUrl);
  }
  return instance;
}

module.exports = { SmsRepository, getRepository };
