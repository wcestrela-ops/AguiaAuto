const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveRepoTenantId,
  shouldApplyTenantFilter,
  sqlAndTenant,
  appendTenantConditions,
  tenantIdForInsert,
} = require('../../src/lib/tenant/repository-tenant');

const ORIGINAL_ENV = process.env.MULTI_TENANT_ENABLED;

beforeEach(() => {
  delete process.env.MULTI_TENANT_ENABLED;
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.MULTI_TENANT_ENABLED;
  else process.env.MULTI_TENANT_ENABLED = ORIGINAL_ENV;
});

test('resolveRepoTenantId normaliza valores', () => {
  assert.equal(resolveRepoTenantId(undefined), 1);
  assert.equal(resolveRepoTenantId(5), 5);
});

test('shouldApplyTenantFilter respeita allTenants', () => {
  assert.equal(shouldApplyTenantFilter(), false);
  process.env.MULTI_TENANT_ENABLED = 'true';
  assert.equal(shouldApplyTenantFilter(), true);
  assert.equal(shouldApplyTenantFilter({ allTenants: true }), false);
});

test('sqlAndTenant adiciona cláusula quando habilitado', () => {
  process.env.MULTI_TENANT_ENABLED = 'true';
  const result = sqlAndTenant(3, 2, { alias: 'il' });
  assert.equal(result.clause, ' AND il.tenant_id = $2');
  assert.deepEqual(result.params, [3]);
});

test('tenantIdForInsert prioriza data.tenant_id', () => {
  assert.equal(tenantIdForInsert({ tenant_id: 7 }, 1), 7);
  assert.equal(tenantIdForInsert({}, 4), 4);
});

test('appendTenantConditions em listagens admin', () => {
  process.env.MULTI_TENANT_ENABLED = 'true';
  const conditions = [];
  const params = [];
  appendTenantConditions(conditions, params, 1, 2, { alias: 'r' });
  assert.equal(conditions[0], 'r.tenant_id = $1');
  assert.deepEqual(params, [2]);
});
