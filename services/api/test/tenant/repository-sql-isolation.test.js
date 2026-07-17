const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const ORIGINAL_ENV = process.env.MULTI_TENANT_ENABLED;
const queries = [];

function mockPool() {
  return {
    query: async (sql, params) => {
      queries.push({ sql: String(sql), params: [...(params || [])] });
      return { rows: [] };
    },
  };
}

function installMockPool() {
  const pool = require('../../src/db/pool');
  pool.getPool = () => mockPool();
}

beforeEach(() => {
  queries.length = 0;
  delete process.env.MULTI_TENANT_ENABLED;
  delete require.cache[require.resolve('../../src/db/pool')];
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.MULTI_TENANT_ENABLED;
  else process.env.MULTI_TENANT_ENABLED = ORIGINAL_ENV;
  Object.keys(require.cache).forEach((key) => {
    if (key.includes('/repositories/') || key.includes('/db/pool')) {
      delete require.cache[key];
    }
  });
});

function loadRepo(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  installMockPool();
  return require(modulePath);
}

test('installation-repository filtra findById por tenant', async () => {
  process.env.MULTI_TENANT_ENABLED = 'true';
  const { getInstallationRepository } = loadRepo('../../src/repositories/installation-repository');
  await getInstallationRepository().findById(99, 2);
  assert.match(queries[0].sql, /il\.tenant_id = \$2/);
  assert.deepEqual(queries[0].params, [99, 2]);
});

test('referral-repository listAll filtra por tenant', async () => {
  process.env.MULTI_TENANT_ENABLED = 'true';
  const { getReferralRepository } = loadRepo('../../src/repositories/referral-repository');
  await getReferralRepository().listAll({ limit: 10, tenantId: 3 });
  assert.match(queries[0].sql, /r\.tenant_id/);
  assert.ok(queries[0].params.includes(3));
});

test('referral-repository listAwaitingCompletion ignora filtro (cron)', async () => {
  process.env.MULTI_TENANT_ENABLED = 'true';
  const { getReferralRepository } = loadRepo('../../src/repositories/referral-repository');
  await getReferralRepository().listAwaitingCompletion();
  assert.doesNotMatch(queries[0].sql, /tenant_id/);
});

test('contract-repository create inclui tenant_id', async () => {
  process.env.MULTI_TENANT_ENABLED = 'true';
  const { getContractRepository } = loadRepo('../../src/repositories/contract-repository');
  await getContractRepository().createAcceptance({
    user_id: 1,
    template_id: 1,
    template_version: 1,
    acceptance_type: 'service',
  }, 4);
  assert.match(queries[0].sql, /tenant_id/);
  assert.ok(queries[0].params.includes(4));
});

test('emergency-event-repository listRecent filtra tenant', async () => {
  process.env.MULTI_TENANT_ENABLED = 'true';
  const { getEmergencyEventRepository } = loadRepo('../../src/repositories/emergency-event-repository');
  await getEmergencyEventRepository().listRecent({ limit: 5, tenantId: 6 });
  assert.match(queries[0].sql, /e\.tenant_id/);
  assert.ok(queries[0].params.includes(6));
});

test('user-repository listAll filtra por tenant', async () => {
  process.env.MULTI_TENANT_ENABLED = 'true';
  const { getUserRepository } = loadRepo('../../src/repositories/user-repository');
  await getUserRepository().listAll(8);
  assert.match(queries[0].sql, /tenant_id = \$1/);
  assert.deepEqual(queries[0].params, [8]);
});
