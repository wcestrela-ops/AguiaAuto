const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  ONBOARDING_STEPS,
  slugify,
  generateTemporaryPassword,
} = require('../../src/services/tenant-onboarding-service');

test('ONBOARDING_STEPS cobre fluxo B2B', () => {
  assert.ok(ONBOARDING_STEPS.includes('criacao_tenant'));
  assert.ok(ONBOARDING_STEPS.includes('integracoes_shared'));
  assert.ok(ONBOARDING_STEPS.includes('assinatura_saas'));
  assert.ok(ONBOARDING_STEPS.includes('usuario_owner'));
});

test('slugify normaliza nome da empresa', () => {
  assert.equal(slugify('Águia Gestão Veicular'), 'guia-gest-o-veicular');
  assert.equal(slugify('Aguia Gestao'), 'aguia-gestao');
  assert.equal(slugify('  Minha Empresa  '), 'minha-empresa');
  assert.equal(slugify('Test@Corp #1'), 'test-corp-1');
});

test('generateTemporaryPassword retorna string longa', () => {
  const pwd = generateTemporaryPassword();
  assert.ok(pwd.length >= 12);
});
