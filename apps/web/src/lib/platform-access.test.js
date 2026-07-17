import { describe, expect, it } from 'vitest';
import {
  filterPlatformNav,
  hasPlatformAccess,
  hasPlatformPermission,
  PLATFORM_ROLES,
} from '../lib/platform-access';

describe('platform-access', () => {
  it('PLATFORM_ROLES contém papéis master', () => {
    expect(PLATFORM_ROLES).toContain('platform_super_admin');
    expect(PLATFORM_ROLES).toContain('platform_admin');
  });

  it('hasPlatformAccess libera superadmin e platform_*', () => {
    expect(hasPlatformAccess({ role: 'superadmin' })).toBe(true);
    expect(hasPlatformAccess({ role: 'platform_admin' })).toBe(true);
    expect(hasPlatformAccess({ role: 'admin' })).toBe(false);
  });

  it('hasPlatformAccess libera permissões platform.*', () => {
    expect(hasPlatformAccess({ role: 'admin', permissions: ['platform.tenants.view'] })).toBe(true);
    expect(hasPlatformAccess({ role: 'admin', permissions: ['billing.view'] })).toBe(false);
  });

  it('hasPlatformPermission verifica slug específico', () => {
    const user = { role: 'platform_support', permissions: ['platform.tenants.view'] };
    expect(hasPlatformPermission(user, 'platform.tenants.view')).toBe(true);
    expect(hasPlatformPermission(user, 'platform.billing.manage')).toBe(false);
  });

  it('filterPlatformNav respeita permissões', () => {
    const nav = [
      { to: '/platform', label: 'Dashboard', permission: 'platform.health.view' },
      { to: '/platform/tenants', label: 'Empresas', permission: 'platform.tenants.view' },
    ];
    const user = { role: 'platform_finance', permissions: ['platform.billing.view'] };
    expect(filterPlatformNav(user, nav)).toEqual([]);
    expect(filterPlatformNav({ role: 'superadmin' }, nav)).toEqual(nav);
  });
});
