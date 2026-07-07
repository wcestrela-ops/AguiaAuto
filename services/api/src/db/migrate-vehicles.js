const { getPool } = require('./pool');

async function migrateVehicles() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS plans (
      id              SERIAL PRIMARY KEY,
      name            VARCHAR(100) NOT NULL,
      description     TEXT,
      price_monthly   DECIMAL(10,2) NOT NULL DEFAULT 0,
      active          BOOLEAN NOT NULL DEFAULT true,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id                SERIAL PRIMARY KEY,
      user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gpswox_device_id  VARCHAR(50),
      gpswox_name       VARCHAR(200),
      plate             VARCHAR(20) NOT NULL,
      brand             VARCHAR(100),
      model             VARCHAR(100),
      color             VARCHAR(50),
      year              INTEGER,
      status            VARCHAR(30) NOT NULL DEFAULT 'pending_installation',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles (user_id);
    CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles (plate);
    CREATE INDEX IF NOT EXISTS idx_vehicles_device ON vehicles (gpswox_device_id);

    CREATE TABLE IF NOT EXISTS subscriptions (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id     INTEGER REFERENCES plans(id),
      vehicle_id  INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
      status      VARCHAR(30) NOT NULL DEFAULT 'active',
      starts_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ends_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions (user_id);
  `);

  // Plano padrão
  await pool.query(`
    INSERT INTO plans (name, description, price_monthly)
    SELECT 'Básico', 'Rastreamento + app', 89.90
    WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Básico')
  `);
}

module.exports = { migrateVehicles };
