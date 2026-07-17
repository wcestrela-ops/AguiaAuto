const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeHost, resolveTenantFromHostHeader } = require('../../src/lib/tenant/tenant-host-resolver');
const { resolveTenantSlugFromHost } = require('../../src/lib/tenant/tenant-resolver');

test('normalizeHost remove porta e lowercase', () => {
  assert.equal(normalizeHost('Gestao.Cliente.COM:443'), 'gestao.cliente.com');
});

test('resolveTenantFromHostHeader prioriza custom_domain', async () => {
  const repo = {
    findByCustomDomain: async (host) => (host === 'gestao.cliente.com' ? { id: 42, slug: 'cliente', active: true } : null),
    findBySlug: async () => null,
  };
  const resolved = await resolveTenantFromHostHeader('gestao.cliente.com', repo);
  assert.equal(resolved.source, 'custom_domain');
  assert.equal(resolved.tenant.id, 42);
});

test('resolveTenantFromHostHeader fallback subdomínio', async () => {
  const repo = {
    findByCustomDomain: async () => null,
    findBySlug: async (slug) => (slug === 'empresa' ? { id: 7, slug: 'empresa', active: true } : null),
  };
  const resolved = await resolveTenantFromHostHeader('empresa.app.localhost', repo);
  assert.equal(resolved.source, 'subdomain');
  assert.equal(resolved.tenant.id, 7);
});

test('resolveTenantSlugFromHost ignora subdomínios reservados', () => {
  assert.equal(resolveTenantSlugFromHost('app.seudominio.com'), null);
});
