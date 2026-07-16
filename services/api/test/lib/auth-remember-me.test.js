const test = require('node:test');
const assert = require('node:assert/strict');

// Inline copy of helper logic from auth-service for unit testing
function isRememberRefreshToken(stored) {
  if (!stored?.expires_at || !stored?.created_at) return false;
  const ttlMs = new Date(stored.expires_at).getTime() - new Date(stored.created_at).getTime();
  return ttlMs > 14 * 24 * 60 * 60 * 1000;
}

test('isRememberRefreshToken detects long-lived refresh sessions', () => {
  const created = new Date('2026-01-01T12:00:00Z');
  const rememberExpiry = new Date('2026-04-01T12:00:00Z');
  const sessionExpiry = new Date('2026-01-02T12:00:00Z');

  assert.equal(isRememberRefreshToken({
    created_at: created,
    expires_at: rememberExpiry,
  }), true);

  assert.equal(isRememberRefreshToken({
    created_at: created,
    expires_at: sessionExpiry,
  }), false);
});
