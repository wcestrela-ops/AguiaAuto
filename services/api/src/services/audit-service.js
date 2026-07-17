const { getAuditRepository } = require('../repositories/audit-repository');
const logger = require('../logger');

class AuditService {
  constructor() {
    this.repo = getAuditRepository();
  }

  async log(entry) {
    try {
      return await this.repo.create(entry);
    } catch (err) {
      logger.error('Falha ao registrar auditoria', { error: err.message, action: entry.action });
      return null;
    }
  }

  adminAction(action, { resourceType, resourceId, metadata, req, oldValues, newValues, severity }) {
    return this.log({
      actor_type: 'admin',
      actor_id: req?.admin?.id ? String(req.admin.id) : (req?.headers?.['x-admin-user'] || 'admin'),
      user_role: req?.admin?.role || null,
      tenant_id: req?.admin?.tenant_id || 1,
      action,
      resource_type: resourceType,
      resource_id: resourceId ? String(resourceId) : null,
      metadata: metadata || null,
      old_values: oldValues || null,
      new_values: newValues || null,
      ip_address: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
      request_id: req?.requestId || null,
      severity: severity || 'info',
    });
  }

  userAction(action, { userId, resourceType, resourceId, metadata, req, severity }) {
    return this.log({
      actor_type: 'user',
      actor_id: userId ? String(userId) : null,
      user_role: req?.user?.role || null,
      tenant_id: req?.user?.tenant_id || 1,
      action,
      resource_type: resourceType,
      resource_id: resourceId ? String(resourceId) : null,
      metadata: metadata || null,
      ip_address: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
      request_id: req?.requestId || null,
      severity: severity || 'info',
    });
  }

  systemAction(action, { resourceType, resourceId, metadata }) {
    return this.log({
      actor_type: 'system',
      actor_id: 'system',
      action,
      resource_type: resourceType,
      resource_id: resourceId ? String(resourceId) : null,
      metadata: metadata || null,
    });
  }
}

let instance = null;

function getAuditService() {
  if (!instance) instance = new AuditService();
  return instance;
}

module.exports = { AuditService, getAuditService };
