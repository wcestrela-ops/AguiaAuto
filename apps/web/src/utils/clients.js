export const PROVISIONING_STATUS_LABELS = {
  pending: 'Pendente',
  completed: 'Concluído',
  partial: 'Parcial',
  failed: 'Falhou',
};

export const PROVISIONING_STATUS_BADGE = {
  pending: 'warning',
  completed: 'success',
  partial: 'warning',
  failed: 'error',
};

export const FINANCIAL_STATUS_LABELS = {
  sem_cobranca: 'Sem cobrança',
  em_dia: 'Em dia',
  atrasado: 'Em atraso',
};

export const FINANCIAL_STATUS_BADGE = {
  sem_cobranca: 'info',
  em_dia: 'success',
  atrasado: 'error',
};

export const INACTIVE_ACCESS_DAYS_DEFAULT = 30;

export function provisioningStatusLabel(status) {
  return PROVISIONING_STATUS_LABELS[status || 'pending'] || status || 'Pendente';
}

export function provisioningStatusBadge(status) {
  return PROVISIONING_STATUS_BADGE[status || 'pending'] || 'info';
}

export function financialStatusLabel(status) {
  return FINANCIAL_STATUS_LABELS[status] || status;
}

export function financialStatusBadge(status) {
  return FINANCIAL_STATUS_BADGE[status] || 'info';
}

export function daysSinceAccess(lastAccessAt) {
  if (!lastAccessAt) return null;
  const date = new Date(lastAccessAt);
  date.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
}

export function isAccessInactive(lastAccessAt, days = INACTIVE_ACCESS_DAYS_DEFAULT) {
  if (!lastAccessAt) return true;
  const elapsed = daysSinceAccess(lastAccessAt);
  return elapsed != null && elapsed >= days;
}

export function accessInactiveHint(lastAccessAt, days = INACTIVE_ACCESS_DAYS_DEFAULT) {
  if (!lastAccessAt) return 'Nunca acessou';
  const elapsed = daysSinceAccess(lastAccessAt);
  if (elapsed == null) return null;
  if (elapsed >= days) return `${elapsed} dias sem acesso`;
  return null;
}
