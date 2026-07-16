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
