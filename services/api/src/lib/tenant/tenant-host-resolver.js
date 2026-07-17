const { resolveTenantSlugFromHost } = require('./tenant-resolver');

function normalizeHost(hostHeader) {
  if (!hostHeader) return null;
  return String(hostHeader).toLowerCase().split(':')[0].trim();
}

function isPlatformHost(host) {
  if (!host) return false;
  const parts = host.split('.').filter(Boolean);
  const sub = parts[0];
  return ['www', 'app', 'api', 'admin', 'platform'].includes(sub);
}

async function resolveTenantFromHostHeader(hostHeader, tenantRepository) {
  const host = normalizeHost(hostHeader);
  if (!host || !tenantRepository) return null;

  const byDomain = await tenantRepository.findByCustomDomain(host);
  if (byDomain) {
    return { tenant: byDomain, source: 'custom_domain', host };
  }

  const slug = resolveTenantSlugFromHost(host);
  if (slug) {
    const bySlug = await tenantRepository.findBySlug(slug);
    if (bySlug) {
      return { tenant: bySlug, source: 'subdomain', host, slug };
    }
  }

  return null;
}

module.exports = {
  normalizeHost,
  isPlatformHost,
  resolveTenantFromHostHeader,
};
