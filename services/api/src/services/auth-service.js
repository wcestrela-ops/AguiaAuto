const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getUserRepository } = require('../repositories/user-repository');

const JWT_SECRET = process.env.JWT_SECRET || '';
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '1h';
const REFRESH_EXPIRES_DAYS = parseInt(process.env.JWT_REFRESH_DAYS || '7', 10);

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
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

class AuthService {
  constructor() {
    this.users = getUserRepository();
  }

  async register({ email, password, name, phone, cpf_cnpj }) {
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

    const user = await this.users.create({ email, password, name, phone, cpf_cnpj });
    return this._issueTokens(user);
  }

  async login({ email, password }) {
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

    return this._issueTokens(user);
  }

  async refresh(refreshToken) {
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
    return this._issueTokens(user);
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

  async _issueTokens(user) {
    const accessToken = signAccessToken(user);
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);

    await this.users.saveRefreshToken(user.id, tokenHash, refreshExpiresAt());

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
