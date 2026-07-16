const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getUserRepository } = require('../repositories/user-repository');
const { getPasswordResetRepository } = require('../repositories/password-reset-repository');
const authNotifications = require('./auth-notifications');
const {
  normalizePasswordResetChannel,
  buildPasswordResetMessage,
} = require('../lib/notification-policy');
const logger = require('../logger');

const JWT_SECRET = process.env.JWT_SECRET || '';
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '1h';
const REFRESH_EXPIRES_DAYS = parseInt(process.env.JWT_REFRESH_DAYS || '7', 10);
const RESET_CODE_EXPIRES_MIN = parseInt(process.env.RESET_CODE_EXPIRES_MIN || '10', 10);
const RESET_MAX_REQUESTS = parseInt(process.env.RESET_MAX_REQUESTS || '3', 10);

const GENERIC_RESET_MESSAGE =
  'Se o e-mail estiver cadastrado, você receberá um código de recuperação.';

function ensureJwtSecret() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET não configurado no servidor.');
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function signAccessToken(user) {
  ensureJwtSecret();
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function verifyAccessToken(token) {
  ensureJwtSecret();
  return jwt.verify(token, JWT_SECRET);
}

function refreshExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + REFRESH_EXPIRES_DAYS);
  return date;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    cpf_cnpj: user.cpf_cnpj,
    role: user.role,
    active: user.active,
    email_verified: user.email_verified,
    last_access_at: user.last_access_at || null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

class AuthService {
  constructor() {
    this.users = getUserRepository();
    this.passwordReset = getPasswordResetRepository();
  }

  _generateResetCode() {
    return String(crypto.randomInt(100000, 999999));
  }

  _resetExpiresAt() {
    const date = new Date();
    date.setMinutes(date.getMinutes() + RESET_CODE_EXPIRES_MIN);
    return date;
  }

  async requestPasswordReset(email, { channel = 'both' } = {}) {
    if (!email) {
      throw new Error('E-mail é obrigatório.');
    }

    const selectedChannel = normalizePasswordResetChannel(channel);
    const user = await this.users.findByEmail(email);

    if (!user || !user.active) {
      return {
        success: true,
        message: GENERIC_RESET_MESSAGE,
        channels: [],
        channel: selectedChannel,
      };
    }

    const recentCount = await this.passwordReset.countRecentRequests(user.id);
    if (recentCount >= RESET_MAX_REQUESTS) {
      throw new Error('Muitas tentativas. Aguarde 15 minutos e tente novamente.');
    }

    const code = this._generateResetCode();
    await this.passwordReset.create(user.id, code, this._resetExpiresAt());

    const { channels: delivered } = await authNotifications.deliverPasswordResetCode({
      user,
      code,
      expiresMin: RESET_CODE_EXPIRES_MIN,
      channel: selectedChannel,
    });

    const message = delivered.length > 0
      ? buildPasswordResetMessage(delivered)
      : GENERIC_RESET_MESSAGE;

    return {
      success: true,
      message,
      channels: delivered,
      channel: selectedChannel,
    };
  }

  async confirmPasswordReset({ email, code, new_password }) {
    if (!email || !code || !new_password) {
      throw new Error('E-mail, código e nova senha são obrigatórios.');
    }
    if (new_password.length < 6) {
      throw new Error('Nova senha deve ter no mínimo 6 caracteres.');
    }

    const user = await this.users.findByEmail(email);
    if (!user || !user.active) {
      throw new Error('Código inválido ou expirado.');
    }

    const token = await this.passwordReset.findValid(user.id, String(code).trim());
    if (!token) {
      throw new Error('Código inválido ou expirado.');
    }

    await this.users.updatePassword(user.id, new_password);
    await this.passwordReset.markUsed(token.id);
    await this.users.revokeAllUserTokens(user.id);

    logger.info('Senha redefinida com sucesso.', { userId: user.id });

    return {
      success: true,
      message: 'Senha alterada com sucesso. Faça login com a nova senha.',
    };
  }

  async register({ email, password, name, phone, cpf_cnpj, plan_id, billing_type, referral_code }, { ip } = {}) {
    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios.');
    }
    if (password.length < 6) {
      throw new Error('Senha deve ter no mínimo 6 caracteres.');
    }

    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new Error('Email já cadastrado.');
    }

    if (referral_code) {
      const { getReferralService } = require('./referral-service');
      const validation = await getReferralService().validateCode(referral_code);
      if (!validation.valido) {
        throw new Error(validation.motivo || 'Código de indicação inválido.');
      }
    }

    const user = await this.users.create({ email, password, name, phone, cpf_cnpj });
    const tokens = await this._issueTokens(user, { ip, forceAccess: true });

    authNotifications.sendRegistrationWelcome({ user, password }).catch((err) => {
      logger.warn('Notificação de cadastro não enviada.', { userId: user.id, err: err.message });
    });

    let referral = null;
    if (referral_code) {
      const { getReferralService } = require('./referral-service');
      try {
        referral = await getReferralService().processReferralOnRegister({
          referredUserId: user.id,
          referralCode: referral_code,
        });
      } catch (err) {
        logger.warn('Falha ao processar indicação no cadastro.', { userId: user.id, err: err.message });
      }
    }

    let provisioning = null;
    if (plan_id) {
      const { getProvisioningService } = require('./provisioning-service');
      try {
        provisioning = await getProvisioningService().provisionNewClient(user.id, {
          plan_id,
          billing_type: billing_type || 'UNDEFINED',
        });
      } catch (err) {
        logger.warn('Provisionamento automático falhou no cadastro.', { userId: user.id, err: err.message });
        provisioning = { status: 'failed', errors: [{ step: 'provision', error: err.message }] };
      }
    } else {
      await this.users.updateProvisioning(user.id, { provisioning_status: 'pending' });
    }

    return { ...tokens, provisioning, referral: referral ? { registered: true } : null };
  }

  async login({ email, password }, { ip } = {}) {
    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios.');
    }

    const user = await this.users.findByEmail(email);
    if (!user || !user.active) {
      throw new Error('Credenciais inválidas.');
    }

    const valid = await this.users.verifyPassword(user, password);
    if (!valid) {
      throw new Error('Credenciais inválidas.');
    }

    return this._issueTokens(user, { ip, forceAccess: true });
  }

  async refresh(refreshToken, { ip } = {}) {
    if (!refreshToken) {
      throw new Error('Refresh token obrigatório.');
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await this.users.findRefreshToken(tokenHash);

    if (!stored || !stored.active) {
      throw new Error('Refresh token inválido ou expirado.');
    }

    const user = await this.users.findById(stored.user_id);
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    await this.users.revokeRefreshToken(tokenHash);
    return this._issueTokens(user, { ip, forceAccess: false });
  }

  async logout(refreshToken) {
    if (refreshToken) {
      await this.users.revokeRefreshToken(hashToken(refreshToken));
    }
    return { success: true };
  }

  async me(userId) {
    const user = await this.users.findById(userId);
    if (!user) throw new Error('Usuário não encontrado.');
    return sanitizeUser(user);
  }

  async changePassword(userId, { current_password, new_password }) {
    if (!new_password || new_password.length < 6) {
      throw new Error('Nova senha deve ter no mínimo 6 caracteres.');
    }

    const user = await this.users.findByIdWithPassword(userId);
    if (!user) throw new Error('Usuário não encontrado.');

    const valid = await this.users.verifyPassword(user, current_password);
    if (!valid) {
      throw new Error('Senha atual incorreta.');
    }

    await this.users.updatePassword(userId, new_password);
    await this.users.revokeAllUserTokens(userId);
    return { success: true, message: 'Senha alterada. Faça login novamente.' };
  }

  async updateProfile(userId, data) {
    const user = await this.users.updateProfile(userId, data);
    return sanitizeUser(user);
  }

  async establishSession(user, { ip, forceAccess = true } = {}) {
    const dbUser = await this.users.findById(user.id);
    if (!dbUser || !dbUser.active) {
      throw new Error('Usuário não encontrado ou inativo.');
    }
    return this._issueTokens(dbUser, { ip, forceAccess });
  }

  async _issueTokens(user, { ip, forceAccess = false } = {}) {
    const accessToken = signAccessToken(user);
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);

    await this.users.saveRefreshToken(user.id, tokenHash, refreshExpiresAt());

    if (user.role === 'client') {
      await this.users.recordClientAccess(user.id, { ip, force: forceAccess });
      if (forceAccess) {
        const refreshed = await this.users.findById(user.id);
        if (refreshed) {
          user.last_access_at = refreshed.last_access_at;
          user.last_access_ip = refreshed.last_access_ip;
        }
      }
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: ACCESS_EXPIRES,
      user: sanitizeUser(user),
    };
  }
}

let instance = null;

function getAuthService() {
  if (!instance) instance = new AuthService();
  return instance;
}

module.exports = {
  AuthService,
  getAuthService,
  verifyAccessToken,
  sanitizeUser,
};
