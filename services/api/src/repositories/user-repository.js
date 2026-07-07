const bcrypt = require('bcryptjs');
const { getPool } = require('../db/pool');

const SALT_ROUNDS = 12;

class UserRepository {
  constructor() {
    this.pool = getPool();
  }

  async findByEmail(email) {
    const { rows } = await this.pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    return rows[0] || null;
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      'SELECT id, email, name, phone, cpf_cnpj, role, active, email_verified, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  }

  async findByIdWithPassword(id) {
    const { rows } = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async create({ email, password, name, phone, cpf_cnpj, role = 'client' }) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await this.pool.query(
      `INSERT INTO users (email, password_hash, name, phone, cpf_cnpj, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, phone, cpf_cnpj, role, active, email_verified, created_at`,
      [email.toLowerCase().trim(), passwordHash, name, phone, cpf_cnpj, role]
    );
    return rows[0];
  }

  async updatePassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.pool.query(
      'UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
      [userId, passwordHash]
    );
  }

  async updateProfile(userId, { name, phone }) {
    const { rows } = await this.pool.query(
      `UPDATE users SET
        name = COALESCE($2, name),
        phone = COALESCE($3, phone),
        updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, name, phone, cpf_cnpj, role, active, email_verified, created_at, updated_at`,
      [userId, name, phone]
    );
    return rows[0];
  }

  async verifyPassword(user, password) {
    return bcrypt.compare(password, user.password_hash);
  }

  async saveRefreshToken(userId, tokenHash, expiresAt) {
    await this.pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt]
    );
  }

  async findRefreshToken(tokenHash) {
    const { rows } = await this.pool.query(
      `SELECT rt.*, u.email, u.role, u.active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.revoked = false AND rt.expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] || null;
  }

  async revokeRefreshToken(tokenHash) {
    await this.pool.query(
      'UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1',
      [tokenHash]
    );
  }

  async revokeAllUserTokens(userId) {
    await this.pool.query(
      'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1',
      [userId]
    );
  }

  async listAll() {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, phone, role, active, cpf_cnpj,
              asaas_customer_id, mercadopago_payer_id, gpswox_user_id,
              provisioning_status, provisioning_errors, created_at
       FROM users
       ORDER BY name NULLS LAST, email`
    );
    return rows;
  }

  async updateProvisioning(userId, data) {
    const { rows } = await this.pool.query(
      `UPDATE users SET
        asaas_customer_id = COALESCE($2, asaas_customer_id),
        mercadopago_payer_id = COALESCE($3, mercadopago_payer_id),
        gpswox_user_id = COALESCE($4, gpswox_user_id),
        provisioning_status = COALESCE($5, provisioning_status),
        provisioning_errors = COALESCE($6, provisioning_errors),
        updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, name, phone, cpf_cnpj, role, active,
                 asaas_customer_id, mercadopago_payer_id, gpswox_user_id,
                 provisioning_status, provisioning_errors, created_at, updated_at`,
      [
        userId,
        data.asaas_customer_id,
        data.mercadopago_payer_id,
        data.gpswox_user_id,
        data.provisioning_status,
        data.provisioning_errors ? JSON.stringify(data.provisioning_errors) : null,
      ]
    );
    return rows[0] || null;
  }

  async findByIdWithProvisioning(id) {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, phone, cpf_cnpj, role, active,
              asaas_customer_id, mercadopago_payer_id, gpswox_user_id,
              provisioning_status, provisioning_errors, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }
}

let instance = null;

function getUserRepository() {
  if (!instance) instance = new UserRepository();
  return instance;
}

module.exports = { UserRepository, getUserRepository };
