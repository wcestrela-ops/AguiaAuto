const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  isMultiTenantEnabled,
  normalizeTenantId,
  DEFAULT_TENANT_ID,
} = require('../../src/lib/tenant/tenant-config');
const {
  tenantWhereClause,
  assertResourceTenant,
  tenantCachePrefix,
  tenantRoomPrefix,
} = require('../../src/lib/tenant/tenant-query');
const {
  resolveTenantFromAuth,
  validateClientTenantScope,
  extractClientTenantId,
} = require('../../src/lib/tenant/tenant-resolver');

const ORIGINAL_ENV = process.env.MULTI_TENANT_ENABLED;

beforeEach(() => {
  delete process.env.MULTI_TENANT_ENABLED;
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.MULTI_TENANT_ENABLED;
  } else {
    process.env.MULTI_TENANT_ENABLED = ORIGINAL_ENV;
  }
});

test('normalizeTenantId usa default para valores inválidos', () => {
  assert.equal(normalizeTenantId(null), DEFAULT_TENANT_ID);
  assert.equal(normalizeTenantId('abc'), DEFAULT_TENANT_ID);
  assert.equal(normalizeTenantId(2), 2);
});

test('isMultiTenantEnabled só ativa com true explícito', () => {
  assert.equal(isMultiTenantEnabled(), false);
  process.env.MULTI_TENANT_ENABLED = 'true';
  assert.equal(isMultiTenantEnabled(), true);
});

test('tenantWhereClause vazio quando multi-tenant desligado', () => {
  const result = tenantWhereClause(2, { paramIndex: 3 });
  assert.equal(result.clause, '');
  assert.deepEqual(result.params, []);
});

test('tenantWhereClause filtra por tenant quando habilitado', () => {
  process.env.MULTI_TENANT_ENABLED = 'true';
  const result = tenantWhereClause(5, { paramIndex: 2, tableAlias: 'v' });
  assert.equal(result.clause, ' AND v.tenant_id = $2');
  assert.deepEqual(result.params, [5]);
});

test('assertResourceTenant permite qualquer recurso com flag desligada', () => {
  assert.equal(assertResourceTenant({ tenant_id: 99 }, 1), true);
});

test('assertResourceTenant bloqueia tenant divergente quando habilitado', () => {
  process.env.MULTI_TENANT_ENABLED = 'true';
  assert.equal(assertResourceTenant({ tenant_id: 2 }, 1), false);
  assert.equal(assertResourceTenant({ tenant_id: 2 }, 2), true);
});

test('resolveTenantFromAuth prioriza admin e user', () => {
  assert.equal(resolveTenantFromAuth({ admin: { tenant_id: 3 } }), 3);
  assert.equal(resolveTenantFromAuth({ user: { tenant_id: 4 } }), 4);
  assert.equal(resolveTenantFromAuth({}), DEFAULT_TENANT_ID);
});

test('validateClientTenantScope rejeita tenant_id spoofed', () => {
  process.env.MULTI_TENANT_ENABLED = 'true';
  const req = { body: { tenant_id: 2 }, user: { tenant_id: 1 } };
  const result = validateClientTenantScope(req, 1);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'TENANT_SCOPE_MISMATCH');
});

test('validateClientTenantScope aceita tenant_id ausente', () => {
  process.env.MULTI_TENANT_ENABLED = 'true';
  const req = { user: { tenant_id: 1 } };
  const result = validateClientTenantScope(req, 1);
  assert.equal(result.ok, true);
  assert.equal(result.tenantId, 1);
});

test('extractClientTenantId lê body, query e params', () => {
  assert.equal(extractClientTenantId({ body: { tenantId: '7' } }), 7);
  assert.equal(extractClientTenantId({ query: { tenant_id: '8' } }), 8);
  assert.equal(extractClientTenantId({ params: { tenant: '9' } }), 9);
});

test('tenantCachePrefix e tenantRoomPrefix namespaced quando habilitado', () => {
  assert.equal(tenantCachePrefix(1), '');
  assert.equal(tenantRoomPrefix(1), 'tenant:1');
  process.env.MULTI_TENANT_ENABLED = 'true';
  assert.equal(tenantCachePrefix(3), 'tenant:3:');
  assert.equal(tenantRoomPrefix(3), 'tenant:3');
});
