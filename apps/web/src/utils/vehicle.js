const STATUS_LABELS = {
  pending_installation: 'Aguardando instalação',
  active: 'Ativo',
  inactive: 'Inativo',
  blocked: 'Bloqueado',
};

const STATUS_BADGE = {
  pending_installation: 'warning',
  active: 'success',
  inactive: 'info',
  blocked: 'error',
};

export function vehicleStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export function vehicleStatusBadge(status) {
  return STATUS_BADGE[status] || 'info';
}
