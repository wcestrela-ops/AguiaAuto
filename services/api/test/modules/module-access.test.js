const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  isPlatformRole,
  PLATFORM_ROLES,
  PLATFORM_PERMISSIONS,
  TENANT_ROLE_ALIASES,
} = require('../../src/lib/security/permissions');
const { resolveModuleForPath, ROUTE_MODULE_MAP } = require('../../src/lib/modules/route-modules');
const { MODULE_DEPENDENCIES } = require('../../src/services/module-access-service');

test('PLATFORM_ROLES contém papéis master', () => {
  assert.ok(PLATFORM_ROLES.includes('platform_super_admin'));
  assert.ok(isPlatformRole('platform_admin'));
  assert.equal(isPlatformRole('admin'), false);
});

test('PLATFORM_PERMISSIONS inclui gestão de tenants', () => {
  const slugs = PLATFORM_PERMISSIONS.map((p) => p.slug);
  assert.ok(slugs.includes('platform.tenants.view'));
  assert.ok(slugs.includes('platform.modules.manage'));
});

test('TENANT_ROLE_ALIASES mapeia TENANT_OWNER para superadmin', () => {
  assert.equal(TENANT_ROLE_ALIASES.TENANT_OWNER, 'superadmin');
});

test('resolveModuleForPath mapeia rotas críticas', () => {
  assert.equal(resolveModuleForPath('GET', '/v1/veiculos'), 'TRACKING');
  assert.equal(resolveModuleForPath('GET', '/v1/financeiro/resumo'), 'FINANCE');
  assert.equal(resolveModuleForPath('GET', '/v1/admin/whatsapp'), 'WHATSAPP');
  assert.equal(resolveModuleForPath('GET', '/v1/auth/me'), null);
});

test('ROUTE_MODULE_MAP cobre financeiro e contratos', () => {
  const modules = new Set(ROUTE_MODULE_MAP.map((r) => r.module));
  assert.ok(modules.has('FINANCE'));
  assert.ok(modules.has('CONTRACTS'));
});

test('MODULE_DEPENDENCIES exige CORE_VEHICLES para TRACKING', () => {
  assert.deepEqual(MODULE_DEPENDENCIES.TRACKING, ['CORE_VEHICLES']);
});
