const { getPool } = require('./pool');

async function migrateTrackerLibrary() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracker_models (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(120) NOT NULL,
      manufacturer  VARCHAR(120),
      protocol      VARCHAR(60),
      description   TEXT,
      active        BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tracker_models_name ON tracker_models (LOWER(name));

    CREATE TABLE IF NOT EXISTS tracker_commands (
      id              SERIAL PRIMARY KEY,
      model_id        INTEGER NOT NULL REFERENCES tracker_models(id) ON DELETE CASCADE,
      action_key      VARCHAR(50) NOT NULL,
      label           VARCHAR(120) NOT NULL,
      sms_template    TEXT NOT NULL,
      gpswox_command  VARCHAR(60),
      sort_order      INTEGER NOT NULL DEFAULT 0,
      active          BOOLEAN NOT NULL DEFAULT true,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (model_id, action_key)
    );

    CREATE INDEX IF NOT EXISTS idx_tracker_commands_model ON tracker_commands (model_id);

    ALTER TABLE vehicles
      ADD COLUMN IF NOT EXISTS tracker_model_id INTEGER REFERENCES tracker_models(id) ON DELETE SET NULL;
  `);

  const { rows } = await pool.query('SELECT id FROM tracker_models WHERE LOWER(name) = $1', ['gt06 / relay padrão']);
  if (rows.length > 0) return;

  const { rows: modelRows } = await pool.query(
    `INSERT INTO tracker_models (name, manufacturer, protocol, description)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      'GT06 / Relay padrão',
      'Genérico',
      'GT06',
      'Comandos SMS relay comuns (RELAY,1# / RELAY,0# / WHERE#)',
    ],
  );
  const modelId = modelRows[0].id;

  const defaults = [
    { action_key: 'bloquear', label: 'Bloquear veículo', sms: 'RELAY,1#', gps: 'engine_stop', sort: 1 },
    { action_key: 'desbloquear', label: 'Desbloquear veículo', sms: 'RELAY,0#', gps: 'engine_resume', sort: 2 },
    { action_key: 'ligar', label: 'Ligar motor', sms: 'RELAY,0#', gps: 'engine_resume', sort: 3 },
    { action_key: 'desligar', label: 'Desligar motor', sms: 'RELAY,1#', gps: 'engine_stop', sort: 4 },
    { action_key: 'localizar', label: 'Solicitar localização', sms: 'WHERE#', gps: 'position_single', sort: 5 },
  ];

  for (const cmd of defaults) {
    await pool.query(
      `INSERT INTO tracker_commands (model_id, action_key, label, sms_template, gpswox_command, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [modelId, cmd.action_key, cmd.label, cmd.sms, cmd.gps, cmd.sort],
    );
  }
}

module.exports = { migrateTrackerLibrary };
