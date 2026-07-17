const { getPool } = require('./pool');

async function migrateSecurityPhase3() {
  const pool = getPool();

  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS two_factor_secret_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS transaction_pin_hash VARCHAR(255);

    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    INSERT INTO tenants (id, name, slug)
    VALUES (1, 'Default', 'default')
    ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_system BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(80) UNIQUE NOT NULL,
      description TEXT,
      category VARCHAR(50),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS password_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history (user_id, created_at DESC);

    ALTER TABLE refresh_tokens
      ADD COLUMN IF NOT EXISTS session_type VARCHAR(20) NOT NULL DEFAULT 'client',
      ADD COLUMN IF NOT EXISTS user_agent TEXT,
      ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
      ADD COLUMN IF NOT EXISTS device_label VARCHAR(120),
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS request_id VARCHAR(64);

    CREATE TABLE IF NOT EXISTS login_attempts (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      success BOOLEAN NOT NULL DEFAULT false,
      reason VARCHAR(100),
      session_type VARCHAR(20) NOT NULL DEFAULT 'client',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts (email, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts (ip_address, created_at DESC);

    CREATE TABLE IF NOT EXISTS user_recovery_codes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash VARCHAR(255) NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id SERIAL PRIMARY KEY,
      event_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
      provider VARCHAR(50) NOT NULL,
      event_id VARCHAR(200),
      payload_hash VARCHAR(64) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'received',
      processed_at TIMESTAMPTZ,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_dedupe
      ON webhook_events (provider, COALESCE(event_id, payload_hash));

    CREATE TABLE IF NOT EXISTS lgpd_consents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      consent_type VARCHAR(50) NOT NULL,
      version VARCHAR(30) NOT NULL,
      accepted BOOLEAN NOT NULL DEFAULT true,
      legal_basis VARCHAR(50),
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_lgpd_consents_user ON lgpd_consents (user_id, consent_type);

    ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT gen_random_uuid(),
      ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS user_role VARCHAR(50),
      ADD COLUMN IF NOT EXISTS old_values JSONB,
      ADD COLUMN IF NOT EXISTS new_values JSONB,
      ADD COLUMN IF NOT EXISTS user_agent TEXT,
      ADD COLUMN IF NOT EXISTS device_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS request_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'info';

    CREATE INDEX IF NOT EXISTS idx_audit_logs_request ON audit_logs (request_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs (tenant_id, created_at DESC);

    ALTER TABLE integration_configs
      ADD COLUMN IF NOT EXISTS settings_encrypted TEXT;
  `);
}

module.exports = { migrateSecurityPhase3 };
