const PERMISSIONS = [
  { slug: 'customers.view', category: 'customers', description: 'Visualizar clientes' },
  { slug: 'customers.create', category: 'customers', description: 'Criar clientes' },
  { slug: 'customers.update', category: 'customers', description: 'Atualizar clientes' },
  { slug: 'customers.delete', category: 'customers', description: 'Excluir clientes' },
  { slug: 'vehicles.view', category: 'vehicles', description: 'Visualizar veículos' },
  { slug: 'vehicles.create', category: 'vehicles', description: 'Criar veículos' },
  { slug: 'vehicles.update', category: 'vehicles', description: 'Atualizar veículos' },
  { slug: 'vehicles.delete', category: 'vehicles', description: 'Excluir veículos' },
  { slug: 'tracking.view', category: 'tracking', description: 'Visualizar rastreamento' },
  { slug: 'tracking.history', category: 'tracking', description: 'Histórico de rastreamento' },
  { slug: 'tracking.command', category: 'tracking', description: 'Enviar comandos' },
  { slug: 'tracking.block', category: 'tracking', description: 'Bloquear veículos' },
  { slug: 'tracking.unblock', category: 'tracking', description: 'Desbloquear veículos' },
  { slug: 'billing.view', category: 'billing', description: 'Visualizar financeiro' },
  { slug: 'billing.manage', category: 'billing', description: 'Gerenciar cobranças' },
  { slug: 'billing.refund', category: 'billing', description: 'Estornos e baixas' },
  { slug: 'contracts.view', category: 'contracts', description: 'Visualizar contratos' },
  { slug: 'contracts.manage', category: 'contracts', description: 'Gerenciar contratos' },
  { slug: 'integrations.view', category: 'integrations', description: 'Visualizar integrações' },
  { slug: 'integrations.manage', category: 'integrations', description: 'Gerenciar integrações' },
  { slug: 'users.manage', category: 'users', description: 'Gerenciar usuários admin' },
  { slug: 'roles.manage', category: 'users', description: 'Gerenciar funções e permissões' },
  { slug: 'audit.view', category: 'audit', description: 'Visualizar auditoria' },
  { slug: 'support.manage', category: 'support', description: 'Suporte ao cliente' },
  { slug: 'settings.manage', category: 'settings', description: 'Configurações gerais' },
  { slug: 'security.view', category: 'security', description: 'Dashboard de segurança' },
  { slug: 'security.manage', category: 'security', description: 'Gerenciar sessões e 2FA' },
  // Tenant management
  { slug: 'tenant.manage', category: 'tenant', description: 'Gerenciar configurações da empresa' },
  { slug: 'modules.view', category: 'modules', description: 'Visualizar módulos contratados' },
  { slug: 'modules.manage', category: 'modules', description: 'Gerenciar módulos da empresa' },
];

const PLATFORM_PERMISSIONS = [
  { slug: 'platform.tenants.view', category: 'platform', description: 'Visualizar empresas' },
  { slug: 'platform.tenants.create', category: 'platform', description: 'Criar empresas' },
  { slug: 'platform.tenants.update', category: 'platform', description: 'Editar empresas' },
  { slug: 'platform.tenants.suspend', category: 'platform', description: 'Suspender empresas' },
  { slug: 'platform.modules.view', category: 'platform', description: 'Visualizar catálogo de módulos' },
  { slug: 'platform.modules.manage', category: 'platform', description: 'Gerenciar módulos globais' },
  { slug: 'platform.health.view', category: 'platform', description: 'Saúde operacional da plataforma' },
  { slug: 'platform.audit.view', category: 'platform', description: 'Auditoria cross-tenant' },
  { slug: 'platform.support.impersonate', category: 'platform', description: 'Modo suporte controlado' },
  { slug: 'platform.billing.view', category: 'platform', description: 'Visualizar planos e assinaturas SaaS' },
  { slug: 'platform.billing.manage', category: 'platform', description: 'Gerenciar planos, assinaturas e limites' },
];

const ALL_PERMISSIONS = [...PERMISSIONS, ...PLATFORM_PERMISSIONS];

const ADMIN_ROLES = ['superadmin', 'admin', 'operator', 'support', 'financeiro', 'supervisor'];

const TENANT_ROLE_ALIASES = {
  TENANT_OWNER: 'superadmin',
  TENANT_ADMIN: 'admin',
  MANAGER: 'supervisor',
  FINANCE: 'financeiro',
  SALES: 'operator',
  SUPPORT: 'support',
  OPERATOR: 'operator',
  INSTALLER: 'installer',
  CUSTOMER: 'client',
  READ_ONLY: 'operator',
};

const PLATFORM_ROLES = ['platform_super_admin', 'platform_admin', 'platform_support', 'platform_finance'];

const ROLE_PERMISSIONS = {
  superadmin: PERMISSIONS.map((p) => p.slug),
  admin: PERMISSIONS.filter((p) => p.slug !== 'roles.manage').map((p) => p.slug),
  financeiro: [
    'customers.view', 'billing.view', 'billing.manage', 'billing.refund',
    'contracts.view', 'audit.view', 'security.view',
  ],
  supervisor: [
    'customers.view', 'customers.update', 'vehicles.view', 'vehicles.update',
    'tracking.view', 'tracking.history', 'billing.view', 'contracts.view',
    'integrations.view', 'audit.view', 'support.manage', 'security.view',
  ],
  support: [
    'customers.view', 'customers.update', 'vehicles.view', 'tracking.view',
    'support.manage', 'audit.view',
  ],
  operator: [
    'vehicles.view', 'vehicles.update', 'tracking.view', 'tracking.history',
    'tracking.command', 'tracking.block', 'tracking.unblock',
  ],
};

const PLATFORM_ROLE_PERMISSIONS = {
  platform_super_admin: PLATFORM_PERMISSIONS.map((p) => p.slug),
  platform_admin: PLATFORM_PERMISSIONS.filter((p) => p.slug !== 'platform.support.impersonate').map((p) => p.slug),
  platform_support: [
    'platform.tenants.view', 'platform.health.view', 'platform.audit.view',
    'platform.support.impersonate', 'platform.modules.view',
  ],
  platform_finance: [
    'platform.tenants.view', 'platform.modules.view', 'platform.health.view',
    'platform.billing.view', 'platform.billing.manage',
  ],
};

function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

function isPlatformRole(role) {
  return PLATFORM_ROLES.includes(role);
}

function isPlatformOrAdminRole(role) {
  return isAdminRole(role) || isPlatformRole(role);
}

function roleRequires2FA(role) {
  return ['superadmin', 'admin', 'financeiro', 'platform_super_admin', 'platform_admin'].includes(role);
}

module.exports = {
  PERMISSIONS,
  PLATFORM_PERMISSIONS,
  ALL_PERMISSIONS,
  ADMIN_ROLES,
  PLATFORM_ROLES,
  TENANT_ROLE_ALIASES,
  ROLE_PERMISSIONS,
  PLATFORM_ROLE_PERMISSIONS,
  isAdminRole,
  isPlatformRole,
  isPlatformOrAdminRole,
  roleRequires2FA,
};
