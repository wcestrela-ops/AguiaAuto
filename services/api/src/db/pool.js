const { Pool } = require('pg');

let pool = null;

function getPool(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não configurada.');
  }
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl });
  }
  return pool;
}

module.exports = { getPool };
