const crypto = require('crypto');
const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');
const { sqlAndTenant, tenantIdForInsert } = require('../lib/tenant/repository-tenant');

class WebhookEventRepository {
  constructor() {
    this.pool = getPool();
  }

  hashPayload(payload) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  async registerEvent({ provider, eventId, payload, tenant_id }, tenantId = DEFAULT_TENANT_ID) {
    const payloadHash = this.hashPayload(payload);
    const tid = tenantIdForInsert({ tenant_id }, tenantId);
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO webhook_events (tenant_id, provider, event_id, payload_hash, status)
         VALUES ($1, $2, $3, $4, 'received')
         ON CONFLICT DO NOTHING
         RETURNING id, event_uuid`,
        [tid, provider, eventId || null, payloadHash],
      );
      if (rows[0]) {
        return { duplicate: false, id: rows[0].id, eventUuid: rows[0].event_uuid };
      }

      const existingParams = [provider, eventId || null, payloadHash];
      let existingSql = `SELECT id, event_uuid FROM webhook_events
         WHERE provider = $1 AND (event_id = $2 OR payload_hash = $3)`;
      const tenant = sqlAndTenant(tenantId, 4);
      existingSql += tenant.clause;
      existingParams.push(...tenant.params);
      existingSql += ' LIMIT 1';

      const existing = await this.pool.query(existingSql, existingParams);
      return { duplicate: true, id: existing.rows[0]?.id, eventUuid: existing.rows[0]?.event_uuid };
    } catch (err) {
      return { duplicate: false, error: err.message };
    }
  }

  async markProcessed(id, tenantId = DEFAULT_TENANT_ID) {
    const params = [id];
    let sql = `UPDATE webhook_events SET status = 'processed', processed_at = NOW() WHERE id = $1`;
    const tenant = sqlAndTenant(tenantId, 2);
    sql += tenant.clause;
    params.push(...tenant.params);
    await this.pool.query(sql, params);
  }

  async markFailed(id, errorMessage, tenantId = DEFAULT_TENANT_ID) {
    const params = [id, errorMessage];
    let sql = `UPDATE webhook_events SET status = 'failed', error_message = $2, processed_at = NOW() WHERE id = $1`;
    const tenant = sqlAndTenant(tenantId, 3);
    sql += tenant.clause;
    params.push(...tenant.params);
    await this.pool.query(sql, params);
  }
}

let instance = null;

function getWebhookEventRepository() {
  if (!instance) instance = new WebhookEventRepository();
  return instance;
}

module.exports = { WebhookEventRepository, getWebhookEventRepository };
