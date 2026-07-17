import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ADMIN_NAV,
  filterAdminNav,
  isMultiTenantNavEnabled,
  resolveAdminPageTitle,
} from './admin-modules.js';

describe('isMultiTenantNavEnabled', () => {
  it('só ativa com VITE_MULTI_TENANT_ENABLED=true', () => {
    vi.stubEnv('VITE_MULTI_TENANT_ENABLED', 'false');
    expect(isMultiTenantNavEnabled()).toBe(false);
    vi.stubEnv('VITE_MULTI_TENANT_ENABLED', 'true');
    expect(isMultiTenantNavEnabled()).toBe(true);
  });
});

describe('filterAdminNav', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MULTI_TENANT_ENABLED', 'false');
  });

  it('retorna todos os itens quando multi-tenant desligado', () => {
    const filtered = filterAdminNav(ADMIN_NAV, [{ code: 'WHATSAPP' }]);
    expect(filtered).toHaveLength(ADMIN_NAV.length);
  });

  it('filtra por módulos ativos quando multi-tenant ligado', () => {
    vi.stubEnv('VITE_MULTI_TENANT_ENABLED', 'true');
    const filtered = filterAdminNav(ADMIN_NAV, [{ code: 'WHATSAPP' }, { code: 'FINANCE' }]);
    const labels = filtered.map((item) => item.label);
    expect(labels).toContain('WhatsApp');
    expect(labels).toContain('Financeiro');
    expect(labels).not.toContain('SMS Rastreador');
    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Integrações');
  });
});

describe('resolveAdminPageTitle', () => {
  it('resolve título por rota e sub-rotas', () => {
    expect(resolveAdminPageTitle('/admin/whatsapp')).toBe('WhatsApp');
    expect(resolveAdminPageTitle('/admin/integracoes/asaas')).toBe('Integração');
    expect(resolveAdminPageTitle('/admin/clientes/42')).toBe('Cliente');
    expect(resolveAdminPageTitle('/admin/desconhecido')).toBe('Águia Admin');
  });
});
