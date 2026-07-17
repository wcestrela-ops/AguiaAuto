const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LEAD_STATUSES } = require('../../src/db/migrate-phase15-crm-leads');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

test('LEAD_STATUSES define pipeline CRM', () => {
  assert.deepEqual(LEAD_STATUSES, ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST']);
});

test('validação de e-mail CRM', () => {
  assert.equal(EMAIL_RE.test('lead@empresa.com'), true);
  assert.equal(EMAIL_RE.test('invalido'), false);
});
