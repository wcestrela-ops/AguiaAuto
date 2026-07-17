const ROUTE_MODULE_MAP = [
  { prefix: '/v1/veiculos', module: 'TRACKING' },
  { prefix: '/v1/financeiro', module: 'FINANCE' },
  { prefix: '/v1/contratos', module: 'CONTRACTS' },
  { prefix: '/v1/alertas', module: 'NOTIFICATIONS' },
  { prefix: '/v1/emergencia', module: 'NOTIFICATIONS' },
  { prefix: '/v1/frota', module: 'CORE_VEHICLES' },
  { prefix: '/v1/indicacoes', module: 'CORE_CUSTOMERS' },
  { prefix: '/v1/instalador', module: 'INSTALLATIONS' },
  { prefix: '/v1/admin/whatsapp', module: 'WHATSAPP' },
  { prefix: '/v1/admin/sms', module: 'SMS' },
  { prefix: '/v1/admin/financeiro', module: 'FINANCE' },
  { prefix: '/v1/admin/contratos', module: 'CONTRACTS' },
  { prefix: '/v1/admin/veiculos', module: 'CORE_VEHICLES' },
  { prefix: '/v1/admin/usuarios', module: 'CORE_CUSTOMERS' },
  { prefix: '/v1/admin/instaladores', module: 'INSTALLATIONS' },
  { prefix: '/v1/admin/site', module: 'LANDING_PAGE' },
  { prefix: '/v1/admin/frota', module: 'CORE_VEHICLES' },
  { prefix: '/v1/admin/export', module: 'REPORTS' },
  { prefix: '/v1/site', module: 'LANDING_PAGE' },
];

function resolveModuleForPath(method, path) {
  const normalized = String(path || '').split('?')[0];
  for (const rule of ROUTE_MODULE_MAP) {
    if (normalized.startsWith(rule.prefix)) {
      return rule.module;
    }
  }
  return null;
}

module.exports = { ROUTE_MODULE_MAP, resolveModuleForPath };
