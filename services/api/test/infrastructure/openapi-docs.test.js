const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { isOpenApiDocsEnabled } = require('../../src/infrastructure/openapi-docs');

const ORIGINAL = process.env.OPENAPI_DOCS_ENABLED;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.OPENAPI_DOCS_ENABLED;
  } else {
    process.env.OPENAPI_DOCS_ENABLED = ORIGINAL;
  }
  delete require.cache[require.resolve('../../src/modules/openapi/routes')];
});

test('isOpenApiDocsEnabled habilitado por padrão', () => {
  delete process.env.OPENAPI_DOCS_ENABLED;
  assert.equal(isOpenApiDocsEnabled(), true);
});

test('isOpenApiDocsEnabled respeita OPENAPI_DOCS_ENABLED=false', () => {
  process.env.OPENAPI_DOCS_ENABLED = 'false';
  assert.equal(isOpenApiDocsEnabled(), false);
});
