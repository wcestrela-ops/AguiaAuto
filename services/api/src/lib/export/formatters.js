function formatDateBr(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-BR');
}

function formatDateTimeBr(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR');
}

function formatMoneyBr(value) {
  if (value == null || value === '') return '';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function cell(value) {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

function exportFilename(base, format) {
  const date = new Date().toISOString().slice(0, 10);
  const ext = format === 'pdf' ? 'pdf' : 'xlsx';
  return `${base}-${date}.${ext}`;
}

module.exports = {
  formatDateBr,
  formatDateTimeBr,
  formatMoneyBr,
  cell,
  exportFilename,
};
