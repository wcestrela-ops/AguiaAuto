const DEFAULT_TENANT_ID = 1;
const DEFAULT_TENANT_SLUG = 'aguia';

function isMultiTenantEnabled() {
  return process.env.MULTI_TENANT_ENABLED === 'true';
}

function normalizeTenantId(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_TENANT_ID;
  return parsed;
}

module.exports = {
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_SLUG,
  isMultiTenantEnabled,
  normalizeTenantId,
};
