const { getPool } = require('../db/pool');

class SiteContentRepository {
  constructor() {
    this.pool = getPool();
  }

  async get(key) {
    const { rows } = await this.pool.query(
      'SELECT * FROM site_content WHERE key = $1',
      [key],
    );
    return rows[0] || null;
  }

  async upsert(key, content, updatedBy = null) {
    const { rows } = await this.pool.query(
      `INSERT INTO site_content (key, content, updated_by)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE SET
         content = EXCLUDED.content,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by
       RETURNING *`,
      [key, JSON.stringify(content), updatedBy],
    );
    return rows[0];
  }
}

let instance = null;

function getSiteContentRepository() {
  if (!instance) instance = new SiteContentRepository();
  return instance;
}

module.exports = { SiteContentRepository, getSiteContentRepository };
