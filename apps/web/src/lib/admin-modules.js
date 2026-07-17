/** Mapeamento rota admin → módulo SaaS (null = sempre visível). */
export const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', end: true, module: null },
  { to: '/admin/integracoes', label: 'Integrações', module: null },
  { to: '/admin/whatsapp', label: 'WhatsApp', module: 'WHATSAPP' },
  { to: '/admin/sms', label: 'SMS Rastreador', module: 'SMS' },
  { to: '/admin/veiculos', label: 'Veículos', module: 'CORE_VEHICLES' },
  { to: '/admin/clientes', label: 'Clientes', module: 'CORE_CUSTOMERS' },
  { to: '/admin/financeiro', label: 'Financeiro', module: 'FINANCE' },
  { to: '/admin/planos', label: 'Planos', module: 'FINANCE' },
  { to: '/admin/site', label: 'Landing page', module: 'LANDING_PAGE' },
  { to: '/admin/alertas', label: 'Alertas', module: 'NOTIFICATIONS' },
  { to: '/admin/emergencia', label: 'Emergência', module: 'NOTIFICATIONS' },
  { to: '/admin/instaladores', label: 'Instaladores', module: 'INSTALLATIONS' },
  { to: '/admin/contratos', label: 'Contratos', module: 'CONTRACTS' },
  { to: '/admin/frota', label: 'Documentos', module: 'CORE_VEHICLES' },
  { to: '/admin/indicacoes', label: 'Indicações', module: 'CORE_CUSTOMERS' },
  { to: '/admin/crm', label: 'CRM / Leads', module: 'CRM' },
  { to: '/admin/seguranca', label: 'Segurança', module: null },
  { to: '/admin/auditoria', label: 'Auditoria', module: 'REPORTS' },
];

export function isMultiTenantNavEnabled() {
  return import.meta.env.VITE_MULTI_TENANT_ENABLED === 'true';
}

export function filterAdminNav(items, activeModuleCodes = []) {
  if (!isMultiTenantNavEnabled()) return items;
  const codes = new Set((activeModuleCodes || []).map((m) => m.code || m));
  return items.filter((item) => !item.module || codes.has(item.module));
}

export function resolveAdminPageTitle(pathname, navItems = ADMIN_NAV) {
  if (pathname.startsWith('/admin/integracoes/')) return 'Integração';
  if (pathname.startsWith('/admin/clientes/')) return 'Cliente';
  const match = navItems.find((item) => item.to === pathname);
  return match?.label || 'Águia Admin';
}
