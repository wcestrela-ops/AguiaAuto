const { verifyAccessToken } = require('../services/auth-service');

function jwtAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';

  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token não informado.' });
  }

  const token = auth.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenant_id: payload.tenant_id || 1,
    };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Token expirado. Use /v1/auth/refresh.'
      : 'Token inválido.';
    return res.status(401).json({ success: false, error: message });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Acesso negado.' });
    }
    next();
  };
}

module.exports = { jwtAuth, requireRole };
