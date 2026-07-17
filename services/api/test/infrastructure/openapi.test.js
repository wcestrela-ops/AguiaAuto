const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('OpenAPI spec.json é válido e cobre rotas SaaS', () => {
  const specPath = path.join(__dirname, '../../openapi/spec.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  assert.equal(spec.openapi, '3.1.0');
  assert.ok(spec.info.title);
  assert.ok(spec.paths['/health/live']);
  assert.ok(spec.paths['/health/ready']);
  assert.ok(spec.paths['/metrics']);
  assert.ok(spec.paths['/v1/openapi.json']);
  assert.ok(spec.paths['/v1/platform/onboarding/tenants']);
  assert.ok(spec.components.securitySchemes.bearerAuth);
  assert.ok(spec.components.securitySchemes.adminCookie);
});

test('módulo openapi routes carrega spec', () => {
  const router = require('../../src/modules/openapi/routes');
  assert.equal(typeof router, 'function');
});
