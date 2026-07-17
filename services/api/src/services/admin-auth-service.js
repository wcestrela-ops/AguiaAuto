const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getAdminUserRepository } = require('../repositories/admin-user-repository');
const { getUserRepository } = require('../repositories/user-repository');
const { getRbacRepository } = require('../repositories/rbac-repository');
const { getLoginAttemptRepository } = require('../repositories/login-attempt-repository');
const { getSessionRepository } = require('../repositories/session-repository');
const { getTwoFactorService } = require('./two-factor-service');
const { getAuditService } = require('./audit-service');
const { validatePassword } = require('../lib/security/password-policy');
const { roleRequires2FA } = require('../lib/security/permissions');
const { getClientIp } = require('../lib/client-ip');
const logger = require('../logger');

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || '';
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_ACCESS_EXPIRES || '1h';
const REFRESH_DAYS = parseInt(process.env.JWT_REFRESH_EXPIRES_IN?.replace(/\D/g, '') || process.env.JWT_ADMIN_REFRESH_DAYS || '1', 10);

const GENERIC_LOGIN_ERROR = 'E-mail ou senha inválidos.';

function ensureJwtSecret() {
  if (!JWT_SECRET) throw new Error('JWT_SECRET não configurado.');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function refreshExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + REFRESH_DAYS);
  return date;
}

function signAdminAccessToken(user, permissions) {
  ensureJwtSecret();
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id || 1,
      aud: 'aguia-admin',
      permissions,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES },
  );
}

function verifyAdminAccessToken(token) {
  ensureJwtSecret();
  const payload = jwt.verify(token, JWT_SECRET, { audience: 'aguia-admin' });
  return payload;
}

function sanitizeAdmin(user, permissions = []) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    tenant_id: user.tenant_id || 1,
    two_factor_enabled: user.two_factor_enabled,
    must_reset_password: user.must_reset_password,
    last_login_at: user.last_login_at,
    permissions,
  };
}

class AdminAuthService {
  constructor() {
    this.admins = getAdminUserRepository();
    this.users = getUserRepository();
    this.rbac = getRbacRepository();
    this.attempts = getLoginAttemptRepository();
    this.sessions = getSessionRepository();
    this.twoFactor = getTwoFactorService();
  }

  async bootstrapSuperAdmin() {
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (!email || !password) return null;

    const count = await this.admins.countAdmins();
    if (count > 0) return null;

    const validation = validatePassword(password, { email });
    if (!validation.valid) {
      logger.warn('ADMIN_BOOTSTRAP_PASSWORD inválida — superadmin não criado.', { errors: validation.errors });
      return null;
    }

    const user = await this.users.create({
      email,
      password,
      name: 'Super Administrador',
      role: 'superadmin',
    });
    await this.rbac.assignRoleToUser(user.id, 'superadmin');
    logger.info('Superadmin bootstrap criado.', { email: user.email });
    return user;
  }

  async login(body, req) {
    const email = body.email;
    const password = body.password;
    const totpCode = body.totpCode || body.totp_code;
    const recoveryCode = body.recoveryCode || body.recovery_code;
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    const recentFailures = await this.attempts.countRecentFailures({ email, ipAddress: ip });
    if (recentFailures >= parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10) * 2) {
      throw new Error('Muitas tentativas. Tente novamente mais tarde.');
    }

    const user = await this.admins.findByEmail(email);
    if (!user || !user.active) {
      await this.attempts.record({
        email, ipAddress: ip, userAgent, success: false, reason: 'invalid_credentials', sessionType: 'admin',
      });
      throw new Error(GENERIC_LOGIN_ERROR);
    }

    if (await this.admins.isLocked(user)) {
      await this.attempts.record({
        email, userId: user.id, ipAddress: ip, userAgent, success: false, reason: 'locked', sessionType: 'admin',
      });
      throw new Error('Conta temporariamente bloqueada. Tente novamente mais tarde.');
    }

    const fullUser = await this.admins.findByIdWithSecrets(user.id);
    const passwordOk = await bcrypt.compare(password, fullUser.password_hash);
    if (!passwordOk) {
      await this.admins.recordFailedLogin(user.id);
      await this.attempts.record({
        email, userId: user.id, ipAddress: ip, userAgent, success: false, reason: 'invalid_password', sessionType: 'admin',
      });
      await getAuditService().log({
        actor_type: 'admin',
        actor_id: String(user.id),
        action: 'auth.login.failed',
        metadata: { reason: 'invalid_password' },
        ip_address: ip,
        user_agent: userAgent,
        request_id: req.requestId,
        severity: 'warning',
      });
      throw new Error(GENERIC_LOGIN_ERROR);
    }

    const requires2FA = user.two_factor_enabled || roleRequires2FA(user.role);
    if (requires2FA && user.two_factor_enabled) {
      let secondFactorOk = false;
      if (totpCode) secondFactorOk = await this.twoFactor.verifyLogin(fullUser, totpCode);
      else if (recoveryCode) secondFactorOk = await this.twoFactor.verifyRecoveryCode(user.id, recoveryCode);
      if (!secondFactorOk) {
        await this.attempts.record({
          email, userId: user.id, ipAddress: ip, userAgent, success: false, reason: 'invalid_2fa', sessionType: 'admin',
        });
        return { requires_2fa: true, message: 'Informe o código 2FA ou código de recuperação.' };
      }
    } else if (requires2FA && !user.two_factor_enabled) {
      return {
        requires_2fa_setup: true,
        message: 'Autenticação em dois fatores obrigatória para esta função.',
        pre_auth: this._issuePreAuthToken(user),
      };
    }

    return this._issueSession(user, req);
  }

  _issuePreAuthToken(user) {
    ensureJwtSecret();
    return jwt.sign(
      { sub: user.id, email: user.email, purpose: 'admin-2fa-setup', aud: 'aguia-admin-preauth' },
      JWT_SECRET,
      { expiresIn: '10m' },
    );
  }

  async _issueSession(user, req) {
    const permissions = await this.rbac.getUserPermissions(user.id);
    const accessToken = signAdminAccessToken(user, permissions);
    const refreshToken = generateRefreshToken();
    const refreshHash = hashToken(refreshToken);

    await this.sessions.createSession({
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt: refreshExpiresAt(),
      sessionType: 'admin',
      userAgent: req.headers['user-agent'],
      ipAddress: getClientIp(req),
      requestId: req.requestId,
    });

    await this.admins.resetFailedLogin(user.id);
    await this.attempts.record({
      email: user.email,
      userId: user.id,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      success: true,
      sessionType: 'admin',
    });

    await getAuditService().log({
      actor_type: 'admin',
      actor_id: String(user.id),
      action: 'auth.login.success',
      ip_address: getClientIp(req),
      user_agent: req.headers['user-agent'],
      request_id: req.requestId,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: sanitizeAdmin(user, permissions),
    };
  }

  async refresh(refreshToken, req) {
    const stored = await this.sessions.findSession(hashToken(refreshToken));
    if (!stored || stored.session_type !== 'admin' || !stored.active) {
      throw new Error('Sessão inválida ou expirada.');
    }

    const user = await this.admins.findById(stored.user_id);
    if (!user?.active) throw new Error('Usuário inativo.');

    await this.sessions.revokeSession(hashToken(refreshToken));

    const permissions = await this.rbac.getUserPermissions(user.id);
    const accessToken = signAdminAccessToken(user, permissions);
    const newRefresh = generateRefreshToken();

    await this.sessions.createSession({
      userId: user.id,
      tokenHash: hashToken(newRefresh),
      expiresAt: refreshExpiresAt(),
      sessionType: 'admin',
      userAgent: req.headers['user-agent'],
      ipAddress: getClientIp(req),
      requestId: req.requestId,
    });

    return {
      access_token: accessToken,
      refresh_token: newRefresh,
      user: sanitizeAdmin(user, permissions),
    };
  }

  async logout(refreshToken) {
    if (refreshToken) {
      await this.sessions.revokeSession(hashToken(refreshToken));
    }
    return { success: true };
  }

  async getMe(userId) {
    const user = await this.admins.findById(userId);
    if (!user) throw new Error('Administrador não encontrado.');
    const permissions = await this.rbac.getUserPermissions(userId);
    return sanitizeAdmin(user, permissions);
  }

  async verifyTransactionPin(userId, pin) {
    const user = await this.admins.findByIdWithSecrets(userId);
    if (!user?.transaction_pin_hash) {
      throw new Error('PIN transacional não configurado.');
    }
    const ok = await bcrypt.compare(String(pin), user.transaction_pin_hash);
    if (!ok) throw new Error('PIN transacional inválido.');
    return true;
  }
}

let instance = null;

function getAdminAuthService() {
  if (!instance) instance = new AdminAuthService();
  return instance;
}

module.exports = {
  AdminAuthService,
  getAdminAuthService,
  verifyAdminAccessToken,
  signAdminAccessToken,
  sanitizeAdmin,
};
