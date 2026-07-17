const { isMultiTenantEnabled, normalizeTenantId, DEFAULT_TENANT_ID } = require('./tenant-config');

function resolveTenantId(explicit) {
  if (explicit != null) return normalizeTenantId(explicit);
  return DEFAULT_TENANT_ID;
}

function tenantWhereClause(tenantId, {
  column = 'tenant_id',
  paramIndex,
  tableAlias = null,
} = {}) {
  if (!isMultiTenantEnabled()) {
    return { clause: '', params: [], nextIndex: paramIndex };
  }

  const col = tableAlias ? `${tableAlias}.${column}` : column;
  const tid = resolveTenantId(tenantId);
  return {
    clause: ` AND ${col} = $${paramIndex}`,
    params: [tid],
    nextIndex: paramIndex + 1,
  };
}

function assertResourceTenant(resource, expectedTenantId) {
  if (!resource) return false;
  if (!isMultiTenantEnabled()) return true;
  const resourceTenant = normalizeTenantId(resource.tenant_id ?? DEFAULT_TENANT_ID);
  const expected = resolveTenantId(expectedTenantId);
  return resourceTenant === expected;
}

function tenantCachePrefix(tenantId) {
  if (!isMultiTenantEnabled()) return '';
  return `tenant:${resolveTenantId(tenantId)}:`;
}

function tenantRoomPrefix(tenantId) {
  return `tenant:${resolveTenantId(tenantId)}`;
}

function appendTenantFilter(conditions, params, idx, tenantId, { column = 'tenant_id', alias = null } = {}) {
  if (!isMultiTenantEnabled()) return idx;
  const col = alias ? `${alias}.${column}` : column;
  conditions.push(`${col} = $${idx}`);
  params.push(resolveTenantId(tenantId));
  return idx + 1;
}

function tenantJoinFilter(tenantId, { userColumn = 'user_id', userAlias = 'u', paramIndex } = {}) {
  if (!isMultiTenantEnabled()) {
    return { join: '', clause: '', params: [] };
  }
  return {
    join: '',
    clause: ` AND ${userAlias}.tenant_id = $${paramIndex}`,
    params: [resolveTenantId(tenantId)],
    userAlias,
  };
}

module.exports = {
  resolveTenantId,
  tenantWhereClause,
  assertResourceTenant,
  tenantCachePrefix,
  tenantRoomPrefix,
  appendTenantFilter,
  tenantJoinFilter,
};
