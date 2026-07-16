const { getPool } = require('./pool');

async function migrateTrackerGpswoxSms() {
  const pool = getPool();
  await pool.query(`
    ALTER TABLE tracker_commands
      ADD COLUMN IF NOT EXISTS gpswox_sms_template_id INTEGER;
  `);
}

module.exports = { migrateTrackerGpswoxSms };
