export function fleetStatusBadgeClass(status) {
  if (status === 'vencido') return 'error';
  if (status === 'vencendo') return 'warning';
  if (status === 'ok') return 'success';
  return 'info';
}

export function fleetStatusLabel(status) {
  const labels = {
    vencido: 'Vencido',
    vencendo: 'Vencendo',
    ok: 'Em dia',
    sem_vencimento: 'Sem vencimento',
  };
  return labels[status] || status || '—';
}
