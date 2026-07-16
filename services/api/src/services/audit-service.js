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

  adminAction(action, { resourceType, resourceId, metadata, req }) {
    return this.log({
      actor_type: 'admin',
      actor_id: req?.headers?.['x-admin-user'] || 'admin',
      action,
      resource_type: resourceType,
      resource_id: resourceId ? String(resourceId) : null,
      metadata: metadata || null,
      ip_address: req?.ip || null,
    });
  }

  userAction(action, { userId, resourceType, resourceId, metadata, req }) {
    return this.log({
      actor_type: 'user',
      actor_id: userId ? String(userId) : null,
      action,
      resource_type: resourceType,
      resource_id: resourceId ? String(resourceId) : null,
      metadata: metadata || null,
      ip_address: req?.ip || null,
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
