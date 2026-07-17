const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { createApp } = require('../../src/create-app');
const { tenantContext } = require('../../src/middleware/tenant-context');

const ORIGINAL_MT = process.env.MULTI_TENANT_ENABLED;
const ORIGINAL_DB = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.MULTI_TENANT_ENABLED;
});

afterEach(() => {
  if (ORIGINAL_MT === undefined) {
    delete process.env.MULTI_TENANT_ENABLED;
  } else {
    process.env.MULTI_TENANT_ENABLED = ORIGINAL_MT;
  }
  if (ORIGINAL_DB === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = ORIGINAL_DB;
  }
});

test('GET /health/live retorna probe live', async () => {
  const app = createApp();
  const res = await request(app).get('/health/live');
  assert.equal(res.status, 200);
  assert.equal(res.body.probe, 'live');
  assert.equal(res.body.status, 'HEALTHY');
});

test('GET /v1/openapi.json retorna spec OpenAPI', async () => {
  const app = createApp();
  const res = await request(app).get('/v1/openapi.json');
  assert.equal(res.status, 200);
  assert.equal(res.body.openapi, '3.1.0');
  assert.ok(res.body.paths['/health/live']);
});

test('GET /v1/tenant/branding retorna branding padrão', { skip: process.env.DATABASE_URL ? false : 'DATABASE_URL ausente' }, async () => {
  const app = createApp();
  const res = await request(app).get('/v1/tenant/branding');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.brand_name);
  assert.ok(res.body.data.primary_color);
});

test('tenantContext rejeita tenant_id spoofed via HTTP', async () => {
  process.env.MULTI_TENANT_ENABLED = 'true';

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: 1, tenant_id: 1 };
    req.requestId = 'test-req';
    next();
  });
  app.use(tenantContext);
  app.get('/scoped', (req, res) => {
    res.json({ success: true, tenantId: req.tenantId });
  });

  const ok = await request(app).get('/scoped');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.tenantId, 1);

  const spoofed = await request(app).get('/scoped?tenant_id=2');
  assert.equal(spoofed.status, 403);
  assert.equal(spoofed.body.error.code, 'TENANT_SCOPE_MISMATCH');
});

test('createApp exporta instância Express reutilizável', () => {
  const a = createApp();
  const b = createApp();
  assert.notEqual(a, b);
  assert.equal(typeof a, 'function');
});
