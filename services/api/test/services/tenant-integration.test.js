const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isSharedCapable } = require('@aguia/integrations');
const {
  CREDENTIAL_MODES,
  mergeNonSecretSettings,
} = require('../../src/services/tenant-integration-service');
const { CREDENTIAL_MODES: MIGRATION_MODES } = require('../../src/db/migrate-phase7-tenant-integrations');

test('CREDENTIAL_MODES define SHARED e OWN', () => {
  assert.equal(CREDENTIAL_MODES.SHARED, 'SHARED');
  assert.equal(CREDENTIAL_MODES.OWN, 'OWN');
  assert.deepEqual(MIGRATION_MODES, ['SHARED', 'OWN']);
});

test('isSharedCapable exclui gateway infra', () => {
  assert.equal(isSharedCapable('asaas'), true);
  assert.equal(isSharedCapable('gpswox'), true);
  assert.equal(isSharedCapable('gateway'), false);
  assert.equal(isSharedCapable('gateway_client'), false);
});

test('mergeNonSecretSettings preserva segredos da base em modo SHARED', () => {
  const merged = mergeNonSecretSettings(
    'asaas',
    { api_key: 'platform-key', sandbox: false },
    { api_key: 'tenant-attempt', sandbox: true },
  );
  assert.equal(merged.api_key, 'platform-key');
  assert.equal(merged.sandbox, true);
});

test('mergeNonSecretSettings mantém base quando tenant não sobrescreve', () => {
  const merged = mergeNonSecretSettings('gpswox', { url: 'https://gps.example.com' }, {});
  assert.equal(merged.url, 'https://gps.example.com');
});
