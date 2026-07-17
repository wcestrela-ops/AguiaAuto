const { getPool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../lib/tenant/tenant-config');

class ExternalEntityMappingRepository {
  constructor() {
    this.pool = getPool();
  }

  async upsert(data) {
    const { rows } = await this.pool.query(
      `INSERT INTO external_entity_mappings (
        tenant_id, provider, entity_type, internal_id, external_id, sync_strategy, metadata, active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
      ON CONFLICT (tenant_id, provider, entity_type, internal_id) DO UPDATE SET
        external_id = EXCLUDED.external_id,
        sync_strategy = COALESCE(EXCLUDED.sync_strategy, external_entity_mappings.sync_strategy),
        metadata = external_entity_mappings.metadata || EXCLUDED.metadata,
        active = EXCLUDED.active,
        updated_at = NOW()
      RETURNING *`,
      [
        data.tenant_id || DEFAULT_TENANT_ID,
        String(data.provider || 'gpswox').toLowerCase(),
        data.entity_type,
        data.internal_id,
        String(data.external_id),
        data.sync_strategy || 'PROVIDER_MASTER',
        JSON.stringify(data.metadata || {}),
        data.active !== false,
      ],
    );
    return rows[0];
  }

  async findExternalId(tenantId, provider, entityType, internalId) {
    const { rows } = await this.pool.query(
      `SELECT external_id FROM external_entity_mappings
       WHERE tenant_id = $1 AND provider = $2 AND entity_type = $3
         AND internal_id = $4 AND active = true
       LIMIT 1`,
      [tenantId, String(provider).toLowerCase(), entityType, internalId],
    );
    return rows[0]?.external_id || null;
  }

  async findInternalId(tenantId, provider, entityType, externalId) {
    const { rows } = await this.pool.query(
      `SELECT internal_id FROM external_entity_mappings
       WHERE tenant_id = $1 AND provider = $2 AND entity_type = $3
         AND external_id = $4 AND active = true
       LIMIT 1`,
      [tenantId, String(provider).toLowerCase(), entityType, String(externalId)],
    );
    return rows[0]?.internal_id ?? null;
  }

  async listByTenant(tenantId, { provider, entityType, limit = 100 } = {}) {
    const params = [tenantId];
    let clause = 'WHERE tenant_id = $1 AND active = true';
    if (provider) {
      params.push(String(provider).toLowerCase());
      clause += ` AND provider = $${params.length}`;
    }
    if (entityType) {
      params.push(entityType);
      clause += ` AND entity_type = $${params.length}`;
    }
    params.push(Math.min(Math.max(limit, 1), 500));
    const { rows } = await this.pool.query(
      `SELECT * FROM external_entity_mappings ${clause}
       ORDER BY updated_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows;
  }

  async deactivate(tenantId, provider, entityType, internalId) {
    const { rows } = await this.pool.query(
      `UPDATE external_entity_mappings SET active = false, updated_at = NOW()
       WHERE tenant_id = $1 AND provider = $2 AND entity_type = $3 AND internal_id = $4
       RETURNING *`,
      [tenantId, String(provider).toLowerCase(), entityType, internalId],
    );
    return rows[0] || null;
  }
}

let instance = null;

function getExternalEntityMappingRepository() {
  if (!instance) instance = new ExternalEntityMappingRepository();
  return instance;
}

module.exports = { ExternalEntityMappingRepository, getExternalEntityMappingRepository };
