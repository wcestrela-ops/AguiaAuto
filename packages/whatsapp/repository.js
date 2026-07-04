const { Pool } = require('pg');
const { maskProvider } = require('./schemas');

class WhatsAppRepository {
  constructor(databaseUrl) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_providers (
        id                   SERIAL PRIMARY KEY,
        provider             VARCHAR(30) NOT NULL,
        enabled              BOOLEAN NOT NULL DEFAULT true,
        is_primary           BOOLEAN NOT NULL DEFAULT false,
        is_backup            BOOLEAN NOT NULL DEFAULT false,
        base_url             TEXT,
        api_key              TEXT,
        access_token         TEXT,
        instance             TEXT,
        session              TEXT,
        phone_number_id      TEXT,
        business_account_id  TEXT,
        app_id               TEXT,
        app_secret           TEXT,
        verify_token         TEXT,
        port                 INTEGER,
        status               VARCHAR(30) DEFAULT 'unknown',
        last_connection      TIMESTAMPTZ,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_whatsapp_providers_primary ON whatsapp_providers (is_primary) WHERE is_primary = true;
      CREATE INDEX IF NOT EXISTS idx_whatsapp_providers_backup ON whatsapp_providers (is_backup) WHERE is_backup = true;

      CREATE TABLE IF NOT EXISTS whatsapp_logs (
        id              SERIAL PRIMARY KEY,
        provider_id     INTEGER REFERENCES whatsapp_providers(id) ON DELETE SET NULL,
        provider_type   VARCHAR(30) NOT NULL,
        action          VARCHAR(50) NOT NULL,
        recipient       VARCHAR(50),
        user_ref        VARCHAR(100),
        success         BOOLEAN NOT NULL,
        response_time   INTEGER,
        error_message   TEXT,
        used_failover   BOOLEAN NOT NULL DEFAULT false,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async list({ masked = true } = {}) {
    const { rows } = await this.pool.query(
      'SELECT * FROM whatsapp_providers ORDER BY is_primary DESC, is_backup DESC, id ASC'
    );
    return masked ? rows.map(maskProvider) : rows;
  }

  async findById(id) {
    const { rows } = await this.pool.query('SELECT * FROM whatsapp_providers WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async getFailoverChain() {
    const { rows } = await this.pool.query(`
      SELECT * FROM whatsapp_providers
      WHERE enabled = true AND (is_primary = true OR is_backup = true)
      ORDER BY is_primary DESC, is_backup DESC, id ASC
    `);
    return rows;
  }

  async create(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO whatsapp_providers (
        provider, enabled, is_primary, is_backup, base_url, api_key, access_token,
        instance, session, phone_number_id, business_account_id, app_id, app_secret,
        verify_token, port, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        data.provider, data.enabled ?? true, data.is_primary ?? false, data.is_backup ?? false,
        data.base_url, data.api_key, data.access_token, data.instance, data.session,
        data.phone_number_id, data.business_account_id, data.app_id, data.app_secret,
        data.verify_token, data.port, data.status || 'unknown',
      ]
    );
    return rows[0];
  }

  async update(id, data) {
    const current = await this.findById(id);
    if (!current) throw new Error('Provedor não encontrado.');

    const merged = { ...current, ...data, id: current.id };
    const { rows } = await this.pool.query(
      `UPDATE whatsapp_providers SET
        provider = $2, enabled = $3, is_primary = $4, is_backup = $5,
        base_url = $6, api_key = $7, access_token = $8, instance = $9,
        session = $10, phone_number_id = $11, business_account_id = $12,
        app_id = $13, app_secret = $14, verify_token = $15, port = $16,
        status = $17, updated_at = NOW()
      WHERE id = $1 RETURNING *`,
      [
        id, merged.provider, merged.enabled, merged.is_primary, merged.is_backup,
        merged.base_url, merged.api_key, merged.access_token, merged.instance,
        merged.session, merged.phone_number_id, merged.business_account_id,
        merged.app_id, merged.app_secret, merged.verify_token, merged.port,
        merged.status || current.status,
      ]
    );
    return rows[0];
  }

  async setPrimary(id) {
    await this.pool.query('UPDATE whatsapp_providers SET is_primary = false WHERE is_primary = true');
    const { rows } = await this.pool.query(
      'UPDATE whatsapp_providers SET is_primary = true, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    if (!rows[0]) throw new Error('Provedor não encontrado.');
    return rows[0];
  }

  async setBackup(id) {
    await this.pool.query('UPDATE whatsapp_providers SET is_backup = false WHERE is_backup = true');
    const { rows } = await this.pool.query(
      'UPDATE whatsapp_providers SET is_backup = true, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    if (!rows[0]) throw new Error('Provedor não encontrado.');
    return rows[0];
  }

  async updateStatus(id, status) {
    await this.pool.query(
      'UPDATE whatsapp_providers SET status = $2, last_connection = NOW(), updated_at = NOW() WHERE id = $1',
      [id, status]
    );
  }

  async delete(id) {
    const { rowCount } = await this.pool.query('DELETE FROM whatsapp_providers WHERE id = $1', [id]);
    if (!rowCount) throw new Error('Provedor não encontrado.');
  }

  async log(entry) {
    await this.pool.query(
      `INSERT INTO whatsapp_logs (
        provider_id, provider_type, action, recipient, user_ref,
        success, response_time, error_message, used_failover
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        entry.provider_id, entry.provider_type, entry.action, entry.recipient,
        entry.user_ref, entry.success, entry.response_time, entry.error_message,
        entry.used_failover || false,
      ]
    );
  }

  async close() {
    await this.pool.end();
  }
}

let instance = null;

function getRepository(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL é obrigatória para o módulo WhatsApp.');
  }
  if (!instance) {
    instance = new WhatsAppRepository(databaseUrl);
  }
  return instance;
}

module.exports = { WhatsAppRepository, getRepository };
