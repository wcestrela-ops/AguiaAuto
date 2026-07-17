const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { isSentryEnabled, initSentry } = require('../../src/infrastructure/sentry');

const ORIGINAL = process.env.SENTRY_DSN;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = ORIGINAL;
  delete require.cache[require.resolve('../../src/infrastructure/sentry')];
});

test('isSentryEnabled false sem SENTRY_DSN', () => {
  delete process.env.SENTRY_DSN;
  const mod = require('../../src/infrastructure/sentry');
  assert.equal(mod.isSentryEnabled(), false);
});

test('initSentry retorna null sem DSN', () => {
  delete process.env.SENTRY_DSN;
  const mod = require('../../src/infrastructure/sentry');
  assert.equal(mod.initSentry(), null);
});
