const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePassword, validateTransactionPin } = require('../../src/lib/security/password-policy');
const { canTransition } = require('../../src/infrastructure/command-states');
const { isAdminRole, roleRequires2FA } = require('../../src/lib/security/permissions');
const { encrypt, decrypt, isEncryptionEnabled } = require('../../src/lib/security/encryption');
const { hashPassword, verifyPassword } = require('../../src/lib/security/password-hash');
const { resolveAdminPermission } = require('../../src/lib/security/admin-route-permissions');

test('validatePassword rejeita senhas fracas', () => {
  const weak = validatePassword('123456', { email: 'admin@test.com' });
  assert.equal(weak.valid, false);
  assert.ok(weak.errors.length > 0);
});

test('validatePassword aceita senha forte', () => {
  const strong = validatePassword('AguiaSegura2026!', { email: 'admin@test.com' });
  assert.equal(strong.valid, true);
});

test('validateTransactionPin exige 4-6 dígitos', () => {
  assert.equal(validateTransactionPin('123').valid, false);
  assert.equal(validateTransactionPin('847291').valid, true);
});

test('isAdminRole identifica papéis administrativos', () => {
  assert.equal(isAdminRole('superadmin'), true);
  assert.equal(isAdminRole('client'), false);
});

test('roleRequires2FA para funções críticas', () => {
  assert.equal(roleRequires2FA('superadmin'), true);
  assert.equal(roleRequires2FA('operator'), false);
});

test('encrypt/decrypt quando ENCRYPTION_KEY configurada', () => {
  if (!isEncryptionEnabled()) {
    assert.ok(true);
    return;
  }
  const secret = encrypt('valor-sensivel');
  assert.equal(decrypt(secret), 'valor-sensivel');
});

test('command states permanecem compatíveis com fluxo crítico', () => {
  assert.equal(canTransition('REQUESTED', 'QUEUED'), true);
  assert.equal(canTransition('CONFIRMED', 'FAILED'), false);
});

test('Argon2id hash e verify', async () => {
  const hash = await hashPassword('AguiaSegura2026!');
  assert.ok(hash.startsWith('$argon2'));
  const ok = await verifyPassword('AguiaSegura2026!', hash);
  assert.equal(ok.valid, true);
  assert.equal(ok.needsRehash, false);
});

test('verifyPassword marca bcrypt para rehash', async () => {
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('AguiaSegura2026!', 12);
  const result = await verifyPassword('AguiaSegura2026!', hash);
  assert.equal(result.valid, true);
  assert.equal(result.needsRehash, true);
});

test('resolveAdminPermission mapeia rotas admin', () => {
  assert.equal(resolveAdminPermission('GET', '/v1/admin/security/dashboard'), 'security.view');
  assert.equal(resolveAdminPermission('POST', '/v1/admin/veiculos'), 'vehicles.update');
  assert.equal(resolveAdminPermission('GET', '/v1/admin/veiculos'), 'vehicles.view');
});
