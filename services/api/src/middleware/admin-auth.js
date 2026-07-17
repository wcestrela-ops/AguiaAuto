const crypto = require('crypto');
const { timingSafeEqual } = require('crypto');
const { verifyAdminAccessToken } = require('../services/admin-auth-service');
const { getRbacRepository } = require('../repositories/rbac-repository');
const { getAdminTokensFromRequest } = require('../lib/security/cookie-auth');
const logger = require('../logger');

function safeEqual(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function attachAdminFromToken(token, req) {
  const payload = verifyAdminAccessToken(token);
  const permissions = payload.permissions || await getRbacRepository().getUserPermissions(payload.sub);
  req.admin = {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    tenant_id: payload.tenant_id || 1,
    permissions,
    legacy: false,
  };
}

async function adminAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const { accessToken: cookieAccess } = getAdminTokensFromRequest(req);

  const bearerToken = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const token = bearerToken || cookieAccess;

  if (token) {
    try {
      await attachAdminFromToken(token, req);
      return next();
    } catch (err) {
      if (err.name !== 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Token administrativo inválido.', requestId: req.requestId },
        });
      }
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Token expirado. Use /v1/admin/auth/refresh.', requestId: req.requestId },
      });
    }
  }

  const legacySecret = process.env.ADMIN_SECRET || '';
  if (legacySecret && auth === `Bearer ${legacySecret}`) {
    logger.warn('ADMIN_SECRET legado utilizado — migre para login individual.', { requestId: req.requestId });
    res.setHeader('X-Deprecation-Warning', 'ADMIN_SECRET is deprecated; use /v1/admin/auth/login');

    req.admin = {
      id: 'legacy-admin',
      email: 'legacy@admin.local',
      role: 'superadmin',
      tenant_id: 1,
      permissions: ['*'],
      legacy: true,
    };
    return next();
  }

  return res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Não autorizado.', requestId: req.requestId },
  });
}

function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Não autenticado.', requestId: req.requestId },
      });
    }

    if (req.admin.permissions.includes('*')) return next();

    const allowed = requiredPermissions.some((perm) => req.admin.permissions.includes(perm));
    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Você não possui permissão para esta operação.',
          requestId: req.requestId,
        },
      });
    }

    return next();
  };
}

function requireActiveAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Não autenticado.', requestId: req.requestId },
    });
  }
  return next();
}

module.exports = adminAuth;
module.exports.requirePermission = requirePermission;
module.exports.requireActiveAdmin = requireActiveAdmin;
module.exports.safeEqual = safeEqual;
