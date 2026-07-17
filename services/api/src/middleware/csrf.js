const { safeEqual } = require('../middleware/admin-auth');
const { getAdminTokensFromRequest, COOKIE_CSRF } = require('../lib/security/cookie-auth');

const EXEMPT_PREFIXES = [
  '/v1/admin/auth/login',
  '/v1/admin/auth/refresh',
  '/v1/admin/auth/logout',
  '/webhooks',
  '/v1/auth',
  '/v1/plans',
  '/v1/site',
  '/health',
];

function isExempt(path) {
  return EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function csrfProtection(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  if (isExempt(req.path)) {
    return next();
  }

  if (!req.path.startsWith('/v1/admin')) {
    return next();
  }

  const { csrfToken: cookieToken } = getAdminTokensFromRequest(req);
  const headerToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];

  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'Token CSRF inválido ou ausente.',
        requestId: req.requestId,
      },
    });
  }

  return next();
}

module.exports = { csrfProtection, COOKIE_CSRF };
