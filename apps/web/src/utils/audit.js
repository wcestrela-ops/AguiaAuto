export const AUDIT_ACTION_LABELS = {
  'client.update': 'Cliente atualizado (admin)',
  'vehicle.create': 'Veículo criado (admin)',
  'vehicle.update': 'Veículo atualizado (admin)',
  'vehicle.command': 'Comando enviado (cliente)',
  'vehicle.command.sms_failover': 'Comando via SMS (failover)',
  'gpswox.sync': 'Sync GPSWOX',
  'fleet.document.create': 'Documento cadastrado (admin)',
  'fleet.document.delete': 'Documento excluído (admin)',
  'fleet.maintenance.create': 'Manutenção registrada (admin)',
  'fleet.maintenance.delete': 'Manutenção excluída (admin)',
  'fleet.reminder.run': 'Lembretes de frota executados',
  'billing.manual_payment': 'Baixa manual de cobrança',
  'billing.charge.create': 'Cobrança criada (admin)',
  'provisioning.run': 'Provisionamento iniciado',
  'provisioning.retry': 'Reprovisionamento',
  'integration.update': 'Integração atualizada',
  'integration.reload': 'Integrações recarregadas',
  'plan.create': 'Plano criado',
  'plan.update': 'Plano atualizado',
  'site.landing.update': 'Landing page atualizada',
  'export.download': 'Exportação de dados',
  'fleet.document.update': 'Documento atualizado (admin)',
  'fleet.maintenance.update': 'Manutenção atualizada (admin)',
};

export const AUDIT_ACTOR_LABELS = {
  admin: 'Admin',
  user: 'Cliente',
  system: 'Sistema',
};

export const AUDIT_RESOURCE_LABELS = {
  user: 'Cliente',
  vehicle: 'Veículo',
  integration: 'Integração',
  plan: 'Plano',
  site: 'Site',
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

export function auditResourceLink(resourceType, resourceId) {
  if (!resourceId) return null;
  if (resourceType === 'user') return `/admin/clientes/${resourceId}`;
  if (resourceType === 'vehicle') return '/admin/veiculos';
  if (resourceType === 'integration') return `/admin/integracoes/${resourceId}`;
  if (resourceType === 'plan') return '/admin/planos';
  if (resourceType === 'site') return '/admin/site';
  return null;
}

export function formatAuditMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return '—';
  const parts = [];

  if (metadata.plate) parts.push(`Placa: ${metadata.plate}`);
  if (metadata.title) parts.push(metadata.title);
  if (metadata.action) parts.push(`Ação: ${metadata.action}`);
  if (metadata.channel) parts.push(`Canal: ${metadata.channel}`);
  if (metadata.status) parts.push(`Status: ${metadata.status}`);
  if (metadata.user_id) parts.push(`Cliente #${metadata.user_id}`);
  if (metadata.invoice_id) parts.push(`Cobrança #${metadata.invoice_id}`);
  if (metadata.value != null) parts.push(`Valor: R$ ${Number(metadata.value).toFixed(2)}`);
  if (metadata.amount != null && metadata.value == null) parts.push(`Valor: R$ ${Number(metadata.amount).toFixed(2)}`);
  if (metadata.reminders_sent != null) parts.push(`Enviados: ${metadata.reminders_sent}`);
  if (metadata.errors_count != null && metadata.errors_count > 0) parts.push(`Erros: ${metadata.errors_count}`);
  if (metadata.manual) parts.push('Execução manual');
  if (metadata.skipped === true) parts.push('Ignorado');
  if (metadata.reason) parts.push(`Motivo: ${metadata.reason}`);
  if (metadata.triggered_by) parts.push(`Origem: ${metadata.triggered_by}`);
  if (metadata.created != null) parts.push(`Criados: ${metadata.created}`);
  if (metadata.updated != null) parts.push(`Atualizados: ${metadata.updated}`);
  if (metadata.skipped != null && metadata.skipped !== true) parts.push(`Ignorados: ${metadata.skipped}`);
  if (metadata.total != null) parts.push(`Total: ${metadata.total}`);
  if (metadata.tracker_phone_changed) parts.push('Chip SMS alterado');
  if (metadata.enabled != null) parts.push(metadata.enabled ? 'Ativa' : 'Desativada');
  if (metadata.features_count != null) parts.push(`${metadata.features_count} recursos`);

  if (parts.length) return parts.join(' · ');
  return JSON.stringify(metadata);
}
