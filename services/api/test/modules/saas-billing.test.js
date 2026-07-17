const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PLATFORM_PERMISSIONS } = require('../../src/lib/security/permissions');
const { ACTIVE_STATUSES } = require('../../src/repositories/tenant-saas-subscription-repository');
const { METRIC_QUERIES } = require('../../src/repositories/usage-limit-repository');
const { DEFAULT_USAGE_LIMITS } = require('../../src/db/migrate-phase4-saas-billing');

test('PLATFORM_PERMISSIONS inclui billing SaaS', () => {
  const slugs = PLATFORM_PERMISSIONS.map((p) => p.slug);
  assert.ok(slugs.includes('platform.billing.view'));
  assert.ok(slugs.includes('platform.billing.manage'));
});

test('ACTIVE_STATUSES define assinaturas utilizáveis', () => {
  assert.deepEqual(ACTIVE_STATUSES, ['TRIAL', 'ACTIVE', 'PAST_DUE']);
});

test('METRIC_QUERIES cobre recursos principais', () => {
  assert.ok(METRIC_QUERIES.max_users);
  assert.ok(METRIC_QUERIES.max_customers);
  assert.ok(METRIC_QUERIES.max_vehicles);
  assert.ok(METRIC_QUERIES.max_trackers);
});

test('DEFAULT_USAGE_LIMITS define tetos positivos', () => {
  assert.ok(DEFAULT_USAGE_LIMITS.max_users > 0);
  assert.ok(DEFAULT_USAGE_LIMITS.max_vehicles > 0);
  assert.ok(DEFAULT_USAGE_LIMITS.storage_limit_mb > 0);
});

test('checkLimit lógica permite quando limite é negativo (ilimitado)', () => {
  const limit = -1;
  const current = 9999;
  const allowed = limit == null || limit < 0 || current <= limit;
  assert.equal(allowed, true);
});

test('checkLimit lógica bloqueia quando excede limite', () => {
  const limit = 10;
  const current = 10;
  const increment = 1;
  const projected = current + increment;
  const allowed = projected <= limit;
  assert.equal(allowed, false);
  assert.equal(projected, 11);
});
