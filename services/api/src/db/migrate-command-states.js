const { getPool } = require('./pool');

async function migrateCommandStates() {
  const pool = getPool();

  await pool.query(`
    ALTER TABLE vehicle_command_logs
      ADD COLUMN IF NOT EXISTS command_uuid UUID,
      ADD COLUMN IF NOT EXISTS state VARCHAR(30),
      ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120),
      ADD COLUMN IF NOT EXISTS provider_response JSONB,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_command_logs_uuid
      ON vehicle_command_logs (command_uuid)
      WHERE command_uuid IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_command_logs_idempotency
      ON vehicle_command_logs (idempotency_key)
      WHERE idempotency_key IS NOT NULL;

    UPDATE vehicle_command_logs
       SET state = CASE
         WHEN status = 'failed' THEN 'FAILED'
         WHEN status IN ('sent', 'duplicate', 'queued') THEN 'SENT'
         ELSE 'REQUESTED'
       END
     WHERE state IS NULL;
  `);
}

module.exports = { migrateCommandStates };
