const { renderTemplate, formatDateBr } = require('./billing-templates');
const { formatDocument, formatMaintenance, expiryStatus } = require('../services/vehicle-fleet-service');

function statusLabel(status) {
  if (status === 'vencido') return 'vencido';
  if (status === 'vencendo') return 'vencendo';
  return status || '';
}

function buildFleetReminderVars({ user, documents = [], maintenance = [] }) {
  const expiredDocs = documents.filter((row) => expiryStatus(row.expiry_date) === 'vencido');
  const expiringDocs = documents.filter((row) => expiryStatus(row.expiry_date) === 'vencendo');
  const overdueMaint = maintenance.filter((row) => expiryStatus(row.next_due_date) === 'vencido');
  const dueMaint = maintenance.filter((row) => expiryStatus(row.next_due_date) === 'vencendo');

  const parts = [];
  if (expiredDocs.length) parts.push(`${expiredDocs.length} documento(s) vencido(s)`);
  if (expiringDocs.length) parts.push(`${expiringDocs.length} documento(s) vencendo`);
  if (overdueMaint.length) parts.push(`${overdueMaint.length} manutenção(ões) atrasada(s)`);
  if (dueMaint.length) parts.push(`${dueMaint.length} manutenção(ões) próxima(s)`);

  const docLines = documents.map((row) => {
    const doc = formatDocument(row);
    const plate = doc.plate || 'Sem placa';
    return `• Doc: ${doc.title} (${plate}) — ${doc.expiry_date_br || '—'} · ${statusLabel(doc.expiry_status)}`;
  });

  const maintLines = maintenance.map((row) => {
    const item = formatMaintenance(row);
    const plate = item.plate || 'Sem placa';
    return `• Manut.: ${item.title} (${plate}) — ${item.next_due_date_br || '—'} · ${statusLabel(item.due_status)}`;
  });

  const detalheItens = [...docLines, ...maintLines].join('\n');

  return {
    cliente: user?.name || user?.email || 'Cliente',
    documentos_vencidos: String(expiredDocs.length),
    documentos_vencendo: String(expiringDocs.length),
    manutencao_atrasada: String(overdueMaint.length),
    manutencao_proxima: String(dueMaint.length),
    resumo: parts.length ? parts.join(' · ') : 'Confira vencimentos no app.',
    detalhe_itens: detalheItens,
    total_itens: String(documents.length + maintenance.length),
  };
}

module.exports = {
  renderTemplate,
  buildFleetReminderVars,
};
