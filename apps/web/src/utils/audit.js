export const AUDIT_ACTION_LABELS = {
  'client.update': 'Cliente atualizado (admin)',
  'vehicle.create': 'Veículo criado (admin)',
  'vehicle.update': 'Veículo atualizado (admin)',
  'vehicle.command': 'Comando enviado (cliente)',
  'vehicle.command.sms_failover': 'Comando via SMS (failover)',
  'gpswox.sync': 'Sync GPSWOX',
};

export const AUDIT_ACTOR_LABELS = {
  admin: 'Admin',
  user: 'Cliente',
  system: 'Sistema',
};

export const AUDIT_RESOURCE_LABELS = {
  user: 'Cliente',
  vehicle: 'Veículo',
};

export function auditActionLabel(action) {
  return AUDIT_ACTION_LABELS[action] || action;
}

export function auditActorLabel(actorType) {
  return AUDIT_ACTOR_LABELS[actorType] || actorType;
}

export function auditResourceLabel(resourceType) {
  if (!resourceType) return '—';
  return AUDIT_RESOURCE_LABELS[resourceType] || resourceType;
}

export function formatAuditMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return '—';
  const parts = [];

  if (metadata.plate) parts.push(`Placa: ${metadata.plate}`);
  if (metadata.action) parts.push(`Ação: ${metadata.action}`);
  if (metadata.channel) parts.push(`Canal: ${metadata.channel}`);
  if (metadata.status) parts.push(`Status: ${metadata.status}`);
  if (metadata.user_id) parts.push(`Cliente #${metadata.user_id}`);
  if (metadata.triggered_by) parts.push(`Origem: ${metadata.triggered_by}`);
  if (metadata.created != null) parts.push(`Criados: ${metadata.created}`);
  if (metadata.updated != null) parts.push(`Atualizados: ${metadata.updated}`);
  if (metadata.skipped != null) parts.push(`Ignorados: ${metadata.skipped}`);
  if (metadata.total != null) parts.push(`Total: ${metadata.total}`);
  if (metadata.tracker_phone_changed) parts.push('Chip SMS alterado');

  if (parts.length) return parts.join(' · ');
  return JSON.stringify(metadata);
}
