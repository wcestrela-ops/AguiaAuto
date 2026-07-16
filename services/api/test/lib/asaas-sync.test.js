const test = require('node:test');
const assert = require('node:assert/strict');
const { isInitialChargeDescription } = require('../../src/services/asaas-sync-service');
const { mapSubscriptionStatus, formatCustomer } = require('../../src/integrations/asaas');

test('isInitialChargeDescription detects adesão charges', () => {
  assert.equal(isInitialChargeDescription('Adesão — Plano Básico'), true);
  assert.equal(isInitialChargeDescription('Mensalidade março'), false);
});

test('mapSubscriptionStatus maps Asaas statuses', () => {
  assert.equal(mapSubscriptionStatus('ACTIVE'), 'active');
  assert.equal(mapSubscriptionStatus('EXPIRED'), 'cancelled');
});

test('formatCustomer normalizes Asaas customer payload', () => {
  const formatted = formatCustomer({
    id: 'cus_123',
    name: 'João',
    email: 'joao@example.com',
    cpfCnpj: '123.456.789-00',
    mobilePhone: '11999999999',
    deleted: false,
  });
  assert.equal(formatted.id, 'cus_123');
  assert.equal(formatted.cpf_cnpj, '123.456.789-00');
  assert.equal(formatted.phone, '11999999999');
});
