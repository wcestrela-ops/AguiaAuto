const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePassword, validateTransactionPin } = require('../../src/lib/security/password-policy');
const { canTransition } = require('../../src/infrastructure/command-states');
const { isAdminRole, roleRequires2FA } = require('../../src/lib/security/permissions');
const { encrypt, decrypt, isEncryptionEnabled } = require('../../src/lib/security/encryption');

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
