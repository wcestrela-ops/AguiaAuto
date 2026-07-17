import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLIENT_NAV,
  CONTRACT_ONLY_NAV,
  filterClientNav,
  isMultiTenantClientNavEnabled,
} from './client-modules.js';

describe('isMultiTenantClientNavEnabled', () => {
  it('só ativa com VITE_MULTI_TENANT_ENABLED=true', () => {
    vi.stubEnv('VITE_MULTI_TENANT_ENABLED', 'false');
    expect(isMultiTenantClientNavEnabled()).toBe(false);
    vi.stubEnv('VITE_MULTI_TENANT_ENABLED', 'true');
    expect(isMultiTenantClientNavEnabled()).toBe(true);
  });
});

describe('filterClientNav', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MULTI_TENANT_ENABLED', 'false');
  });

  it('retorna todos os itens quando multi-tenant desligado', () => {
    expect(filterClientNav(CLIENT_NAV, [{ code: 'TRACKING' }])).toHaveLength(CLIENT_NAV.length);
  });

  it('filtra por módulos ativos quando multi-tenant ligado', () => {
    vi.stubEnv('VITE_MULTI_TENANT_ENABLED', 'true');
    const filtered = filterClientNav(CLIENT_NAV, [{ code: 'TRACKING' }, { code: 'CONTRACTS' }]);
    const labels = filtered.map((item) => item.label);
    expect(labels).toContain('Meus Veículos');
    expect(labels).toContain('Contratos');
    expect(labels).toContain('Início');
    expect(labels).toContain('Meu Perfil');
    expect(labels).not.toContain('Financeiro');
    expect(labels).not.toContain('Alertas');
  });

  it('CONTRACT_ONLY_NAV permanece intacto', () => {
    vi.stubEnv('VITE_MULTI_TENANT_ENABLED', 'true');
    expect(filterClientNav(CONTRACT_ONLY_NAV, [])).toEqual(CONTRACT_ONLY_NAV);
  });
});
