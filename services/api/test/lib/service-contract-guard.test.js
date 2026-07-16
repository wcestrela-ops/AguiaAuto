const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { checkServiceContractAccess } = require('../../src/lib/service-contract-guard');

describe('checkServiceContractAccess', () => {
  it('libera instalador sem consultar aceite', async () => {
    let called = false;
    const result = await checkServiceContractAccess(
      { id: 1, role: 'installer' },
      async () => { called = true; return false; },
    );
    assert.equal(result.allowed, true);
    assert.equal(called, false);
  });

  it('libera cliente com contrato aceito', async () => {
    const result = await checkServiceContractAccess(
      { id: 2, role: 'client' },
      async () => true,
    );
    assert.equal(result.allowed, true);
  });

  it('bloqueia cliente sem aceite com CONTRACT_REQUIRED', async () => {
    const result = await checkServiceContractAccess(
      { id: 3, role: 'client' },
      async () => false,
    );
    assert.equal(result.allowed, false);
    assert.equal(result.status, 403);
    assert.equal(result.body.error, 'CONTRACT_REQUIRED');
  });
});
