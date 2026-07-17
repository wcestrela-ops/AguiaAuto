const crypto = require('crypto');
const { getPool } = require('../db/pool');

class WebhookEventRepository {
  constructor() {
    this.pool = getPool();
  }

  hashPayload(payload) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  async registerEvent({ provider, eventId, payload }) {
    const payloadHash = this.hashPayload(payload);
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO webhook_events (provider, event_id, payload_hash, status)
         VALUES ($1, $2, $3, 'received')
         ON CONFLICT DO NOTHING
         RETURNING id, event_uuid`,
        [provider, eventId || null, payloadHash],
      );
      if (rows[0]) {
        return { duplicate: false, id: rows[0].id, eventUuid: rows[0].event_uuid };
      }

      const existing = await this.pool.query(
        `SELECT id, event_uuid FROM webhook_events
         WHERE provider = $1 AND (event_id = $2 OR payload_hash = $3)
         LIMIT 1`,
        [provider, eventId || null, payloadHash],
      );
      return { duplicate: true, id: existing.rows[0]?.id, eventUuid: existing.rows[0]?.event_uuid };
    } catch (err) {
      return { duplicate: false, error: err.message };
    }
  }

  async markProcessed(id) {
    await this.pool.query(
      `UPDATE webhook_events SET status = 'processed', processed_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async markFailed(id, errorMessage) {
    await this.pool.query(
      `UPDATE webhook_events SET status = 'failed', error_message = $2, processed_at = NOW() WHERE id = $1`,
      [id, errorMessage],
    );
  }
}

let instance = null;

function getWebhookEventRepository() {
  if (!instance) instance = new WebhookEventRepository();
  return instance;
}

module.exports = { WebhookEventRepository, getWebhookEventRepository };
