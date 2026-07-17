const { test } = require('node:test');
const assert = require('node:assert/strict');
const { aggregateStatus, getReadinessReport } = require('../../src/infrastructure/health-service');

test('aggregateStatus classifica componentes', () => {
  assert.equal(aggregateStatus({ api: { status: 'HEALTHY' }, postgres: { status: 'HEALTHY' } }), 'HEALTHY');
  assert.equal(
    aggregateStatus({ api: { status: 'HEALTHY' }, postgres: { status: 'UNAVAILABLE' } }),
    'UNAVAILABLE',
  );
  assert.equal(
    aggregateStatus({ api: { status: 'HEALTHY' }, redis: { status: 'DEGRADED' } }),
    'DEGRADED',
  );
});

test('getReadinessReport retorna estrutura com probe ready', async () => {
  const report = await getReadinessReport();
  assert.ok(report.timestamp);
  assert.ok(typeof report.uptimeSeconds === 'number');
  assert.ok(report.components.postgres);
  assert.ok(['HEALTHY', 'UNAVAILABLE'].includes(report.status));
});
