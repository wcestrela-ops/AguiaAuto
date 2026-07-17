const { DEFAULT_TENANT_ID, isMultiTenantEnabled, normalizeTenantId } = require('./tenant-config');
const { tenantWhereClause, appendTenantFilter } = require('./tenant-query');

function resolveRepoTenantId(tenantId) {
  return normalizeTenantId(tenantId ?? DEFAULT_TENANT_ID);
}

function shouldApplyTenantFilter({ allTenants = false } = {}) {
  return isMultiTenantEnabled() && !allTenants;
}

function sqlAndTenant(tenantId, paramIndex, { alias = null, allTenants = false } = {}) {
  if (!shouldApplyTenantFilter({ allTenants })) {
    return { clause: '', params: [], nextIndex: paramIndex };
  }
  const filter = tenantWhereClause(tenantId, {
    paramIndex,
    tableAlias: alias || undefined,
  });
  return { clause: filter.clause, params: filter.params, nextIndex: filter.nextIndex };
}

function appendTenantConditions(conditions, params, nextIdx, tenantId, { alias = null, allTenants = false } = {}) {
  if (!shouldApplyTenantFilter({ allTenants })) return nextIdx;
  return appendTenantFilter(conditions, params, nextIdx, tenantId, alias ? { alias } : {});
}

function tenantIdForInsert(data, fallback = DEFAULT_TENANT_ID) {
  return resolveRepoTenantId(data?.tenant_id ?? fallback);
}

module.exports = {
  resolveRepoTenantId,
  shouldApplyTenantFilter,
  sqlAndTenant,
  appendTenantConditions,
  tenantIdForInsert,
};
