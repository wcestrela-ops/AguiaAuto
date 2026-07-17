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
];

const ADMIN_ROLES = ['superadmin', 'admin', 'operator', 'support', 'financeiro', 'supervisor'];

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

function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

function roleRequires2FA(role) {
  return ['superadmin', 'admin', 'financeiro'].includes(role);
}

module.exports = {
  PERMISSIONS,
  ADMIN_ROLES,
  ROLE_PERMISSIONS,
  isAdminRole,
  roleRequires2FA,
};
