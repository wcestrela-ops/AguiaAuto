const platformAuth = require('./admin-auth');
const { isPlatformRole } = require('../lib/security/permissions');

async function platformAuthMiddleware(req, res, next) {
  await new Promise((resolve) => {
    platformAuth(req, res, resolve);
  });

  if (res.headersSent || !req.admin) return;

  const isPlatform = isPlatformRole(req.admin.role)
    || req.admin.permissions?.includes('*')
    || req.admin.permissions?.some((p) => String(p).startsWith('platform.'));

  if (!isPlatform && req.admin.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'PLATFORM_ACCESS_DENIED',
        message: 'Acesso restrito a operadores da plataforma.',
        requestId: req.requestId,
      },
    });
  }

  req.platform = { operatorId: req.admin.id, role: req.admin.role };
  return next();
}

function requirePlatformPermission(...permissions) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Não autenticado.', requestId: req.requestId },
      });
    }

    if (req.admin.permissions?.includes('*')) return next();

    const allowed = permissions.some((perm) => req.admin.permissions?.includes(perm));
    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Sem permissão de plataforma para esta operação.',
          requestId: req.requestId,
        },
      });
    }

    return next();
  };
}

module.exports = platformAuthMiddleware;
module.exports.requirePlatformPermission = requirePlatformPermission;
