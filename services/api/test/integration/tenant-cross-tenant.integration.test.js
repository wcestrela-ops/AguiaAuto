const { test } = require('node:test');
const assert = require('node:assert/strict');

const DATABASE_URL = process.env.DATABASE_URL;
const RUN_INTEGRATION = process.env.TENANT_INTEGRATION_TEST === 'true' && DATABASE_URL;

test('cross-tenant: tenant A não lê veículo do tenant B', { skip: RUN_INTEGRATION ? false : 'DATABASE_URL + TENANT_INTEGRATION_TEST=true' }, async () => {
  process.env.MULTI_TENANT_ENABLED = 'true';

  const { getPool } = require('../../src/db/pool');
  const pool = getPool();

  const slugA = `test-a-${Date.now()}`;
  const slugB = `test-b-${Date.now()}`;

  const tenantA = await pool.query(
    `INSERT INTO tenants (name, trade_name, slug, email, status)
     VALUES ('Test A', 'Test A', $1, 'a@test.local', 'TRIAL') RETURNING id`,
    [slugA],
  );
  const tenantB = await pool.query(
    `INSERT INTO tenants (name, trade_name, slug, email, status)
     VALUES ('Test B', 'Test B', $1, 'b@test.local', 'TRIAL') RETURNING id`,
    [slugB],
  );

  const idA = tenantA.rows[0].id;
  const idB = tenantB.rows[0].id;

  const userA = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, tenant_id)
     VALUES ($1, 'hash', 'User A', 'client', $2) RETURNING id`,
    [`a-${Date.now()}@test.local`, idA],
  );
  const userB = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, tenant_id)
     VALUES ($1, 'hash', 'User B', 'client', $2) RETURNING id`,
    [`b-${Date.now()}@test.local`, idB],
  );

  const vehicleB = await pool.query(
    `INSERT INTO vehicles (user_id, tenant_id, plate, brand, model, status)
     VALUES ($1, $2, 'BBB1A11', 'Brand', 'Model', 'active') RETURNING id`,
    [userB.rows[0].id, idB],
  );

  delete require.cache[require.resolve('../../src/repositories/vehicle-repository')];
  const { getVehicleRepository } = require('../../src/repositories/vehicle-repository');

  const crossRead = await getVehicleRepository().findById(vehicleB.rows[0].id, idA);
  assert.equal(crossRead, null);

  const ownRead = await getVehicleRepository().findById(vehicleB.rows[0].id, idB);
  assert.ok(ownRead);

  await pool.query('DELETE FROM vehicles WHERE id = $1', [vehicleB.rows[0].id]);
  await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [[userA.rows[0].id, userB.rows[0].id]]);
  await pool.query('DELETE FROM tenants WHERE id = ANY($1::int[])', [[idA, idB]]);
});
