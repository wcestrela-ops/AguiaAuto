/** Mapeamento rota PWA cliente → módulo SaaS (null = sempre visível). */
export const CLIENT_NAV = [
  { to: '/app', label: 'Início', end: true, module: null },
  { to: '/app/veiculos', label: 'Meus Veículos', module: 'TRACKING' },
  { to: '/app/financeiro', label: 'Financeiro', module: 'FINANCE' },
  { to: '/app/contratos', label: 'Contratos', module: 'CONTRACTS' },
  { to: '/app/frota', label: 'Documentos', module: 'CORE_VEHICLES' },
  { to: '/app/emergencia', label: 'Emergência', module: 'NOTIFICATIONS' },
  { to: '/app/alertas', label: 'Alertas', module: 'NOTIFICATIONS' },
  { to: '/app/perfil', label: 'Meu Perfil', module: null },
];

/** Contrato pendente — só libera aceite (sempre visível). */
export const CONTRACT_ONLY_NAV = [
  { to: '/app/contratos', label: 'Contratos', end: true, module: null },
];

export function isMultiTenantClientNavEnabled() {
  return import.meta.env.VITE_MULTI_TENANT_ENABLED === 'true';
}

export function filterClientNav(items, activeModuleCodes = []) {
  if (!isMultiTenantClientNavEnabled()) return items;
  const codes = new Set((activeModuleCodes || []).map((m) => m.code || m));
  return items.filter((item) => !item.module || codes.has(item.module));
}
