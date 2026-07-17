const crypto = require('crypto');
const { authenticator } = require('otplib');
const { encrypt, decrypt } = require('../lib/security/encryption');
const { getAdminUserRepository } = require('../repositories/admin-user-repository');

authenticator.options = { window: 1 };

function getTotpIssuer() {
  return process.env.TOTP_ISSUER || 'AguiaAuto';
}

class TwoFactorService {
  constructor() {
    this.admins = getAdminUserRepository();
  }

  generateSecret(email) {
    return authenticator.generateSecret();
  }

  buildOtpAuthUrl(email, secret) {
    return authenticator.keyuri(email, getTotpIssuer(), secret);
  }

  async setup(userId, email) {
    const secret = this.generateSecret(email);
    const encrypted = encrypt(secret);
    await this.admins.setTwoFactorSecret(userId, encrypted, false);
    return {
      secret,
      otpauth_url: this.buildOtpAuthUrl(email, secret),
    };
  }

  async verifySetup(userId, code) {
    const user = await this.admins.findByIdWithSecrets(userId);
    if (!user?.two_factor_secret_encrypted) {
      throw new Error('2FA não iniciado.');
    }
    const secret = decrypt(user.two_factor_secret_encrypted);
    if (!authenticator.verify({ token: code, secret })) {
      throw new Error('Código 2FA inválido.');
    }
    await this.admins.setTwoFactorSecret(userId, user.two_factor_secret_encrypted, true);
    const recoveryCodes = await this.generateRecoveryCodes(userId);
    return { enabled: true, recovery_codes: recoveryCodes };
  }

  async verifyLogin(user, code) {
    if (!user.two_factor_enabled || !user.two_factor_secret_encrypted) {
      return false;
    }
    const secret = decrypt(user.two_factor_secret_encrypted);
    return authenticator.verify({ token: code, secret });
  }

  async verifyRecoveryCode(userId, code) {
    const { getPool } = require('../db/pool');
    const pool = getPool();
    const hash = crypto.createHash('sha256').update(String(code)).digest('hex');
    const { rows } = await pool.query(
      `UPDATE user_recovery_codes
       SET used_at = NOW()
       WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
       RETURNING id`,
      [userId, hash],
    );
    return Boolean(rows[0]);
  }

  async generateRecoveryCodes(userId, count = 8) {
    const { getPool } = require('../db/pool');
    const pool = getPool();
    await pool.query('DELETE FROM user_recovery_codes WHERE user_id = $1 AND used_at IS NULL', [userId]);

    const codes = [];
    for (let i = 0; i < count; i += 1) {
      const code = crypto.randomBytes(4).toString('hex');
      codes.push(code);
      const hash = crypto.createHash('sha256').update(code).digest('hex');
      await pool.query(
        'INSERT INTO user_recovery_codes (user_id, code_hash) VALUES ($1, $2)',
        [userId, hash],
      );
    }
    return codes;
  }

  async disable(userId, code) {
    const user = await this.admins.findByIdWithSecrets(userId);
    const ok = await this.verifyLogin(user, code);
    if (!ok) throw new Error('Código 2FA inválido.');
    await this.admins.setTwoFactorSecret(userId, null, false);
    const { getPool } = require('../db/pool');
    await getPool().query('DELETE FROM user_recovery_codes WHERE user_id = $1', [userId]);
    return { disabled: true };
  }
}

let instance = null;

function getTwoFactorService() {
  if (!instance) instance = new TwoFactorService();
  return instance;
}

module.exports = { TwoFactorService, getTwoFactorService };
