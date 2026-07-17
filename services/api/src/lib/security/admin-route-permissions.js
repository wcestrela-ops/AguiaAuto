const { requirePermission } = require('../../middleware/admin-auth');

const PREFIX_RULES = [
  { prefix: '/v1/admin/export', permission: 'settings.manage' },
  { prefix: '/v1/admin/integracoes', get: 'integrations.view', mutate: 'integrations.manage' },
  { prefix: '/v1/admin/whatsapp', get: 'integrations.view', mutate: 'integrations.manage' },
  { prefix: '/v1/admin/sms', get: 'integrations.view', mutate: 'integrations.manage' },
  { prefix: '/v1/admin/veiculos', get: 'vehicles.view', mutate: 'vehicles.update' },
  { prefix: '/v1/admin/usuarios', get: 'customers.view', mutate: 'customers.update' },
  { prefix: '/v1/admin/financeiro', get: 'billing.view', mutate: 'billing.manage' },
  { prefix: '/v1/admin/plans', get: 'settings.manage', mutate: 'settings.manage' },
  { prefix: '/v1/admin/alertas', get: 'settings.manage', mutate: 'settings.manage' },
  { prefix: '/v1/admin/comunicacao', get: 'support.manage', mutate: 'support.manage' },
  { prefix: '/v1/admin/instaladores', get: 'users.manage', mutate: 'users.manage' },
  { prefix: '/v1/admin/contratos', get: 'contracts.view', mutate: 'contracts.manage' },
  { prefix: '/v1/admin/audit', get: 'audit.view' },
  { prefix: '/v1/admin/frota', get: 'vehicles.view', mutate: 'vehicles.update' },
  { prefix: '/v1/admin/indicacoes', get: 'customers.view', mutate: 'customers.update' },
  { prefix: '/v1/admin/emergencia', get: 'support.manage' },
  { prefix: '/v1/admin/site', get: 'settings.manage', mutate: 'settings.manage' },
  { prefix: '/v1/admin/dashboard', get: 'settings.manage' },
  { prefix: '/v1/admin/security', get: 'security.view', mutate: 'security.manage' },
  { prefix: '/v1/admin/lgpd', get: 'audit.view', mutate: 'customers.update' },
];

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function resolveAdminPermission(method, path) {
  const normalized = path.split('?')[0];
  for (const rule of PREFIX_RULES) {
    if (!normalized.startsWith(rule.prefix)) continue;
    if (MUTATING.has(method)) return rule.mutate || rule.permission || rule.get;
    return rule.get || rule.permission;
  }
  return null;
}

function adminRbac(req, res, next) {
  if (!req.admin) return next();

  const permission = resolveAdminPermission(req.method, req.originalUrl || req.path);
  if (!permission) return next();

  return requirePermission(permission)(req, res, next);
}

module.exports = { resolveAdminPermission, adminRbac, PREFIX_RULES };
